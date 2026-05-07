/**
 * mint-remaining.js — Mint remaining positions for LGP (3), OGC (3), IGS (7) reactors
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE = 10000;

const TOKENS = {
  DDD: { addr: '0x4bf82cf0d6b2afc87367052b793097153c859d38', dec: 18 },
  EGP: { addr: '0x64f6f111e9fdb753877f17f399b759de97379170', dec: 18 },
  OGC: { addr: '0xccf37622e6b72352e7b410481dd4913563038b7c', dec: 18 },
  IGS: { addr: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', dec: 8 },
  BTN: { addr: '0xd7c584d40216576f1d8651eab8bef9de69497666', dec: 8 },
  LGP: { addr: '0xddc330761761751e005333208889bfe36c6e6760', dec: 18 },
  DHG: { addr: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a', dec: 8 },
  PKT: { addr: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', dec: 18 },
};

const REACTORS = {
  LGP: '0xAcbC4df046AC437c75EE020A534740dd5e425E41',
  OGC: '0xDFF8c75f825e757923fF8f0dE83F814e02fDe5B4',
  IGS: '0x8e662E4b7f5e33DfC5F73E8A67b34E9e147825AA',
};

const JOBS = [
  { reactor: 'LGP', pairs: ['BTN', 'DHG', 'PKT'] },
  { reactor: 'OGC', pairs: ['LGP', 'DHG', 'PKT'] },
  { reactor: 'IGS', pairs: ['DDD', 'EGP', 'OGC', 'BTN', 'LGP', 'DHG', 'PKT'] },
];

const ERC20 = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const NPM_ABI = [
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function safeTransferFrom(address,address,uint256)',
];
const REACTOR_ABI = ['function addPool(uint256) external', 'function poolCount() view returns (uint256)'];
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)', 'function createPool(address,address,uint24) returns (address)'];
const POOL_ABI = ['function initialize(uint160 sqrtPriceX96)'];

function log(msg) { console.log('[' + new Date().toLocaleTimeString() + '] ' + msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gas() {
  const fee = await p.getFeeData();
  return { maxFeePerGas: fee.maxFeePerGas * 2n, maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n };
}

function getSqrtPriceX96(dec0, dec1) {
  const Q96 = 2n ** 96n;
  const diff = dec1 - dec0;
  if (diff === 0) return Q96;
  if (diff === 10) return Q96 * 100000n;
  if (diff === -10) return Q96 / 100000n;
  return Q96;
}

async function ensurePool(factory, addrA, addrB, decA, decB) {
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(addrA, addrB, FEE);
  if (poolAddr !== ZERO) return;
  log('  Creating V3 1% pool...');
  const tx = await factory.createPool(addrA, addrB, FEE, await gas());
  await tx.wait();
  poolAddr = await factory.getPool(addrA, addrB, FEE);
  log('  Pool: ' + poolAddr);
  const t0isA = addrA.toLowerCase() < addrB.toLowerCase();
  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  const tx2 = await pool.initialize(
    getSqrtPriceX96(t0isA ? decA : decB, t0isA ? decB : decA),
    await gas()
  );
  await tx2.wait();
  log('  Initialized');
}

async function main() {
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, wallet);

  log('Checking approvals...');
  for (const [name, t] of Object.entries(TOKENS)) {
    const c = new ethers.Contract(t.addr, ERC20, wallet);
    const allow = await c.allowance(wallet.address, NPM);
    if (allow < ethers.parseUnits('10000000', t.dec)) {
      log('Approving ' + name + '...');
      const tx = await c.approve(NPM, ethers.MaxUint256, await gas());
      await tx.wait();
    }
  }
  log('Approvals done');

  let minted = 0;
  const skipped = [];

  for (const job of JOBS) {
    const nation = job.reactor;
    const nationT = TOKENS[nation];
    const reactorAddr = REACTORS[nation];
    const reactor = new ethers.Contract(reactorAddr, REACTOR_ABI, wallet);
    const existingCount = Number(await reactor.poolCount());
    log('\n========== ' + nation + ' REACTOR (' + existingCount + ' existing) ==========');

    for (const pairName of job.pairs) {
      const pairT = TOKENS[pairName];
      const AMOUNT = ethers.parseUnits('100000', nationT.dec);

      const nationC = new ethers.Contract(nationT.addr, ERC20, wallet);
      const nationBal = await nationC.balanceOf(wallet.address);
      if (nationBal < AMOUNT) {
        log('  SKIP ' + nation + '/' + pairName + ' -- low ' + nation);
        skipped.push(nation + '/' + pairName);
        continue;
      }
      const pairC = new ethers.Contract(pairT.addr, ERC20, wallet);
      const pairBal = await pairC.balanceOf(wallet.address);
      if (pairBal === 0n) {
        log('  SKIP ' + nation + '/' + pairName + ' -- zero ' + pairName);
        skipped.push(nation + '/' + pairName);
        continue;
      }
      const pair100k = ethers.parseUnits('100000', pairT.dec);
      const pairUse = pairBal < pair100k ? pairBal : pair100k;

      log('\n  --- ' + nation + '/' + pairName + ' ---');
      log('  ' + nation + ': 100K | ' + pairName + ': ' + Number(ethers.formatUnits(pairUse, pairT.dec)).toLocaleString());

      try {
        await ensurePool(factory, nationT.addr, pairT.addr, nationT.dec, pairT.dec);

        const nationLower = nationT.addr.toLowerCase() < pairT.addr.toLowerCase();
        const token0 = nationLower ? nationT.addr : pairT.addr;
        const token1 = nationLower ? pairT.addr : nationT.addr;
        const amount0 = nationLower ? AMOUNT : pairUse;
        const amount1 = nationLower ? pairUse : AMOUNT;

        const deadline = Math.floor(Date.now() / 1000) + 600;
        const tx = await npm.mint({
          token0, token1, fee: FEE,
          tickLower: -887200, tickUpper: 887200,
          amount0Desired: amount0, amount1Desired: amount1,
          amount0Min: 0n, amount1Min: 0n,
          recipient: wallet.address, deadline,
        }, await gas());
        const receipt = await tx.wait();
        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const mintLog = receipt.logs.find(l =>
          l.address.toLowerCase() === NPM.toLowerCase() && l.topics[0] === transferTopic
        );
        const tokenId = BigInt(mintLog.topics[3]);
        log('  MINTED #' + tokenId.toString());

        const tx2 = await npm.safeTransferFrom(wallet.address, reactorAddr, tokenId, await gas());
        await tx2.wait();
        log('  Transferred');

        const tx3 = await reactor.addPool(tokenId, await gas());
        await tx3.wait();
        const newCount = await reactor.poolCount();
        log('  addPool done -- ' + nation + ' reactor: ' + newCount.toString() + ' pools');
        minted++;

        log('  Waiting 2 min...');
        await sleep(120000);
      } catch (e) {
        log('  ERROR: ' + (e.shortMessage || e.message).slice(0, 200));
        skipped.push(nation + '/' + pairName + ' (error)');
      }
    }
  }

  log('\n\n========== DONE ==========');
  log('Minted: ' + minted);
  if (skipped.length) {
    log('Skipped:');
    skipped.forEach(s => log('  - ' + s));
  }
  log('\nFinal counts:');
  for (const [name, addr] of Object.entries(REACTORS)) {
    const r = new ethers.Contract(addr, REACTOR_ABI, p);
    const c = await r.poolCount();
    log('  ' + name + ': ' + c.toString() + ' pools');
  }
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
