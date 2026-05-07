/**
 * charity-reactor-keeper.js — Fires 1 charity reactor per day, rotating through all 4.
 * PR24, PR25, fJLT-F24, TB01. Each reactor fires once every 4 days.
 * Uses same wallet as reactor-keeper.js (BALANCER_PRIVATE_KEY).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-bor-rpc.publicnode.com';
const PK  = process.env.BALANCER_PRIVATE_KEY;

const REACTORS = [
  { name: 'PR24',     addr: '0x2502Bc4a3E64938E26F418Aa04399A31eF2C0c6e', token: '0xd84415C956F44b2300a2E56c5B898401913e9A29', dec: 18 },
  { name: 'PR25',     addr: '0x515f63B570674FA5a6722CD01a15dDbb7F2091F5', token: '0x72e4327f592e9cb09d5730a55d1d68de144af53c', dec: 10 },
  { name: 'fJLT-F24', addr: '0xfcf9c71E575DD41b1d750012454cC00836004dEF', token: '0xcdb4574adb7c6643153a65ee1a953afd5a189cef', dec: 6 },
  { name: 'TB01',     addr: '0xfC276AcD76acBC6a43307678B3Abb1d75E9894a5', token: '0xCB2A97776C87433050e0ddF9DE0f53eAd661dab4', dec: 18 },
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

function msUntilNoonUTC() {
  const now = new Date();
  let target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  if (target.getTime() <= now.getTime()) {
    target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 12, 0, 0));
  }
  return target.getTime() - now.getTime();
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
    return;
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
  } catch (e) {
    const msg = (e.shortMessage || e.message).slice(0, 100);
    log(reactor.name + ': ERROR ' + msg);
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  log('Charity Reactor Keeper started');
  log('Wallet: ' + wallet.address);
  log('Reactors: ' + REACTORS.map(r => r.name).join(', '));
  log('Schedule: 1 reactor at noon UTC, full rotation every 4 days');

  const pol = await provider.getBalance(wallet.address);
  log('POL: ' + Number(ethers.formatEther(pol)).toFixed(2));

  let idx = 0;

  // Wait for first noon UTC
  const waitMs = msUntilNoonUTC();
  log('Waiting ' + Math.round(waitMs / 3600000) + 'h for noon UTC...');
  await sleep(waitMs);

  while (true) {
    const r = REACTORS[idx % REACTORS.length];
    log('');
    log('--- [Day ' + (idx + 1) + '] Firing ' + r.name + ' ---');
    await fireReactor(r, wallet, provider);
    idx++;

    const nextWait = msUntilNoonUTC();
    log('Next reactor (' + REACTORS[idx % REACTORS.length].name + ') at noon UTC (' + Math.round(nextWait / 3600000) + 'h)');
    await sleep(nextWait);
  }
}

main().catch(e => {
  console.error('Fatal:', e.shortMessage || e.message);
  process.exit(1);
});
