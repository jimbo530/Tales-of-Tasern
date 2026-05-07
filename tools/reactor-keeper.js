/**
 * reactor-keeper.js — Fires 1 game-token reactor per day, rotating through all 8.
 * Each reactor fires once every 8 days. Runs indefinitely.
 * Charity reactors handled by charity-reactor-keeper.js.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK  = process.env.BALANCER_PRIVATE_KEY;

const REACTORS = [
  { name: 'DDD', addr: '0x0d8389435abACD28410AD240613572E3d3573ADE', token: '0x4bf82cf0d6b2afc87367052b793097153c859d38', dec: 18 },
  { name: 'BTN', addr: '0x2b35C282c21cE95C6050254318044DF530079521', token: '0xd7c584d40216576f1d8651eab8bef9de69497666', dec: 8 },
  { name: 'LGP', addr: '0xAcbC4df046AC437c75EE020A534740dd5e425E41', token: '0xddc330761761751e005333208889bfe36c6e6760', dec: 18 },
  { name: 'PKT', addr: '0x7c78B9368f27Da50ee48BaA213DF001b67A69559', token: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', dec: 18 },
  { name: 'EGP', addr: '0xA4756770d5366F11DE43BF620C21098A54de76dA', token: '0x64f6f111e9fdb753877f17f399b759de97379170', dec: 18 },
  { name: 'OGC', addr: '0xDFF8c75f825e757923fF8f0dE83F814e02fDe5B4', token: '0xccf37622e6b72352e7b410481dd4913563038b7c', dec: 18 },
  { name: 'IGS', addr: '0x8e662E4b7f5e33DfC5F73E8A67b34E9e147825AA', token: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', dec: 8 },
  { name: 'DHG', addr: '0x4ce08087953cb06C14A8Cd7cCEb130377762C170', token: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a', dec: 8 },
];

const DEAD = '0x000000000000000000000000000000000000dEaD';

const REACTOR_ABI = [
  'function execute()',
  'function poolCount() view returns (uint256)',
];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

function log(msg) {
  console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function msUntilMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return tomorrow.getTime() - now.getTime();
}

async function fireReactor(reactor, wallet, provider) {
  const contract = new ethers.Contract(reactor.addr, REACTOR_ABI, wallet);
  const tokenC = new ethers.Contract(reactor.token, ERC20_ABI, provider);

  // Check cooldown via slot 0
  const slot0 = await provider.getStorage(reactor.addr, 0);
  const lastExec = Number(BigInt(slot0));
  const now = Math.floor(Date.now() / 1000);
  const cooldownLeft = (lastExec + 7200) - now;

  if (cooldownLeft > 0) {
    log(reactor.name + ': cooldown ' + Math.ceil(cooldownLeft / 60) + ' min remaining, skip');
    return { name: reactor.name, status: 'cooldown', burned: 0 };
  }

  // Get burn balance before
  const burnedBefore = await tokenC.balanceOf(DEAD);

  // Fire
  const fee = await provider.getFeeData();
  try {
    const tx = await contract.execute({
      maxFeePerGas: fee.maxFeePerGas * 2n,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n,
      gasLimit: 5000000,
    });
    const receipt = await tx.wait();

    // Get burn balance after
    const burnedAfter = await tokenC.balanceOf(DEAD);
    const newBurn = burnedAfter - burnedBefore;
    const burnFmt = Number(ethers.formatUnits(newBurn, reactor.dec)).toFixed(2);

    // Parse event
    const eventTopic = '0x0c5cd750ead56b918dfeda9ef57dcaea9726d76976c7d2b4b730eae8c3d5e29d';
    const execLog = receipt.logs.find(l => l.topics[0] === eventTopic);
    let bought = '0';
    if (execLog) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'address'], execLog.data
      );
      bought = Number(ethers.formatUnits(decoded[1], reactor.dec)).toFixed(2);
    }

    log(reactor.name + ': FIRED | burned=' + burnFmt + ' | bought=' + bought + ' | gas=' + receipt.gasUsed.toString());
    return { name: reactor.name, status: 'fired', burned: burnFmt, bought };
  } catch (e) {
    const msg = (e.shortMessage || e.message).slice(0, 100);
    log(reactor.name + ': ERROR ' + msg);
    return { name: reactor.name, status: 'error', error: msg };
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  log('Reactor Keeper started');
  log('Wallet: ' + wallet.address);
  log('Reactors: ' + REACTORS.length);
  log('Schedule: 1 reactor at midnight UTC, full rotation every 8 days');

  const pol = await provider.getBalance(wallet.address);
  log('POL: ' + Number(ethers.formatEther(pol)).toFixed(2));

  let idx = 0;

  // Wait for first midnight UTC
  const waitMs = msUntilMidnightUTC();
  log('Waiting ' + Math.round(waitMs / 3600000) + 'h for midnight UTC...');
  await sleep(waitMs);

  while (true) {
    const r = REACTORS[idx % REACTORS.length];
    log('');
    log('--- [Day ' + (idx + 1) + '] Firing ' + r.name + ' ---');
    await fireReactor(r, wallet, provider);
    idx++;

    const nextWait = msUntilMidnightUTC();
    log('Next reactor (' + REACTORS[idx % REACTORS.length].name + ') at midnight UTC (' + Math.round(nextWait / 3600000) + 'h)');
    await sleep(nextWait);
  }
}

main().catch(e => {
  console.error('Fatal:', e.shortMessage || e.message);
  process.exit(1);
});
