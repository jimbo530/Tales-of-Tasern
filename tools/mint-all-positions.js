/**
 * mint-all-positions.js — Mint all V3 positions for all 8 nation reactors.
 * Creates missing pools, mints full-range 1% positions, transfers to reactors, registers.
 * 100K of nation token per position. Skips pairs where balance is insufficient.
 * Usage: node mint-all-positions.js
 *        node mint-all-positions.js BTN    (only BTN reactor)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK  = process.env.BALANCER_PRIVATE_KEY;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE = 10000;
const TICK_LOW = -887200;
const TICK_HIGH = 887200;
const DELAY_MS = 120000; // 2 min between positions

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

// Reactor addresses — filled after deploy-all-reactors.js completes
const REACTORS = {
  DDD: '0x0d8389435abACD28410AD240613572E3d3573ADE',
  BTN: '0x2b35C282c21cE95C6050254318044DF530079521',
  LGP: '0xAcbC4df046AC437c75EE020A534740dd5e425E41',
  PKT: '', // fill after deploy
  EGP: '', // fill after deploy
  OGC: '', // fill after deploy
  IGS: '', // fill after deploy
  DHG: '', // fill after deploy
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const NPM_ABI = [
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function safeTransferFrom(address,address,uint256)',
];
const REACTOR_ABI = [
  'function addPool(uint256) external',
  'function poolCount() view returns (uint256)',
];
const FACTORY_ABI = [
  'function getPool(address,address,uint24) view returns (address)',
  'function createPool(address,address,uint24) returns (address)',
];
const POOL_ABI = [
  'function initialize(uint160 sqrtPriceX96)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Calculate sqrtPriceX96 for 1:1 value ratio given decimal difference
function getSqrtPriceX96(dec0, dec1) {
  // price = (10^dec0) / (10^dec1) in raw terms for 1:1 value
  // sqrtPriceX96 = sqrt(price) * 2^96
  const Q96 = 2n ** 96n;
  const decDiff = dec1 - dec0;
  if (decDiff === 0) return Q96; // 1:1

  // For positive decDiff (token1 has more decimals): price > 1
  // For negative decDiff (token0 has more decimals): price < 1
  // Use integer math: sqrtPriceX96 = Q96 * sqrt(10^|decDiff|) or Q96 / sqrt(10^|decDiff|)
  const absDiff = Math.abs(decDiff);
  // sqrt(10^n) approximation via BigInt
  // 10^5 = 100000, sqrt = 316.227... ≈ 316228
  // 10^10 = 10000000000, sqrt = 100000
  if (absDiff === 10) {
    return decDiff > 0 ? Q96 * 100000n : Q96 / 100000n;
  }
  // Fallback for other diffs (shouldn't happen with our tokens)
  const factor = 10n ** BigInt(absDiff);
  // Approximate sqrt via Newton's method
  let x = factor;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + factor / x) / 2n; }
  return decDiff > 0 ? Q96 * x : Q96 / x;
}

async function ensurePool(factory, wallet, tokenA, tokenB, decA, decB) {
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(tokenA, tokenB, FEE);
  if (poolAddr !== ZERO) return poolAddr;

  log('  Creating V3 1% pool...');
  const tx = await factory.createPool(tokenA, tokenB, FEE);
  await tx.wait();
  poolAddr = await factory.getPool(tokenA, tokenB, FEE);
  log('  Pool created: ' + poolAddr);

  // Determine token0/token1 order for price
  const t0isA = tokenA.toLowerCase() < tokenB.toLowerCase();
  const dec0 = t0isA ? decA : decB;
  const dec1 = t0isA ? decB : decA;
  const sqrtPrice = getSqrtPriceX96(dec0, dec1);

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  log('  Initializing pool...');
  const tx2 = await pool.initialize(sqrtPrice);
  await tx2.wait();
  log('  Pool initialized');
  return poolAddr;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, wallet);

  const filterNation = process.argv[2] ? process.argv[2].toUpperCase() : null;
  const nations = filterNation ? [filterNation] : Object.keys(REACTORS);

  // Approve all tokens to NPM first
  log('Checking approvals...');
  for (const name of Object.keys(TOKENS)) {
    const t = TOKENS[name];
    const c = new ethers.Contract(t.addr, ERC20_ABI, wallet);
    const allow = await c.allowance(wallet.address, NPM);
    if (allow < ethers.parseUnits('1000000', t.dec)) {
      log('Approving ' + name + '...');
      const tx = await c.approve(NPM, ethers.MaxUint256);
      await tx.wait();
      log(name + ' approved');
    }
  }

  let totalMinted = 0;
  let skipped = [];

  for (const nation of nations) {
    const reactorAddr = REACTORS[nation];
    if (!reactorAddr) {
      log('\n=== SKIP ' + nation + ' — no reactor address ===');
      skipped.push(nation + ' (no reactor)');
      continue;
    }

    const reactor = new ethers.Contract(reactorAddr, REACTOR_ABI, wallet);
    const nationToken = TOKENS[nation];
    const AMOUNT = ethers.parseUnits('100000', nationToken.dec);

    // Get existing pool tokenIds to avoid duplicates
    const existingCount = Number(await reactor.poolCount());

    log('\n========== ' + nation + ' REACTOR (' + reactorAddr.slice(0,10) + '...) — ' + existingCount + ' existing ==========');

    for (const pairName of Object.keys(TOKENS)) {
      if (pairName === nation) continue;

      const pairToken = TOKENS[pairName];

      // Check nation token balance
      const nationC = new ethers.Contract(nationToken.addr, ERC20_ABI, wallet);
      const nationBal = await nationC.balanceOf(wallet.address);
      if (nationBal < AMOUNT) {
        log('  SKIP ' + nation + '/' + pairName + ' — only ' + ethers.formatUnits(nationBal, nationToken.dec) + ' ' + nation);
        skipped.push(nation + '/' + pairName + ' (low ' + nation + ')');
        continue;
      }

      // Check pair token balance (need at least something)
      const pairC = new ethers.Contract(pairToken.addr, ERC20_ABI, wallet);
      const pairBal = await pairC.balanceOf(wallet.address);
      if (pairBal === 0n) {
        log('  SKIP ' + nation + '/' + pairName + ' — zero ' + pairName);
        skipped.push(nation + '/' + pairName + ' (zero ' + pairName + ')');
        continue;
      }

      // Use 100K of pair token too (or all if less)
      const pairAmount100k = ethers.parseUnits('100000', pairToken.dec);
      const pairUse = pairBal < pairAmount100k ? pairBal : pairAmount100k;

      log('\n--- ' + nation + '/' + pairName + ' ---');
      log('  ' + nation + ': 100K | ' + pairName + ': ' + Number(ethers.formatUnits(pairUse, pairToken.dec)).toLocaleString());

      // Ensure pool exists
      await ensurePool(factory, wallet, nationToken.addr, pairToken.addr, nationToken.dec, pairToken.dec);

      // Token ordering
      const nationLower = nationToken.addr.toLowerCase() < pairToken.addr.toLowerCase();
      const token0 = nationLower ? nationToken.addr : pairToken.addr;
      const token1 = nationLower ? pairToken.addr : nationToken.addr;
      const amount0 = nationLower ? AMOUNT : pairUse;
      const amount1 = nationLower ? pairUse : AMOUNT;

      // Mint
      const deadline = Math.floor(Date.now() / 1000) + 600;
      try {
        const tx = await npm.mint({
          token0, token1, fee: FEE,
          tickLower: TICK_LOW, tickUpper: TICK_HIGH,
          amount0Desired: amount0, amount1Desired: amount1,
          amount0Min: 0n, amount1Min: 0n,
          recipient: wallet.address, deadline,
        });
        const receipt = await tx.wait();

        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const mintLog = receipt.logs.find(l =>
          l.address.toLowerCase() === NPM.toLowerCase() && l.topics[0] === transferTopic
        );
        const tokenId = BigInt(mintLog.topics[3]);
        log('  MINTED #' + tokenId.toString() + ' (gas: ' + receipt.gasUsed.toString() + ')');

        // Transfer to reactor
        log('  Transferring to reactor...');
        const tx2 = await npm.safeTransferFrom(wallet.address, reactorAddr, tokenId);
        await tx2.wait();

        // Register
        log('  addPool(' + tokenId.toString() + ')...');
        const tx3 = await reactor.addPool(tokenId);
        await tx3.wait();

        const newCount = await reactor.poolCount();
        log('  DONE — ' + nation + ' reactor now has ' + newCount.toString() + ' pools');
        totalMinted++;

        // Delay before next
        if (DELAY_MS > 0) {
          log('  Waiting ' + (DELAY_MS/1000) + 's...');
          await sleep(DELAY_MS);
        }
      } catch (e) {
        log('  ERROR: ' + (e.shortMessage || e.message).slice(0, 200));
        skipped.push(nation + '/' + pairName + ' (error)');
      }
    }
  }

  log('\n\n========== SUMMARY ==========');
  log('Positions minted: ' + totalMinted);
  if (skipped.length > 0) {
    log('Skipped (' + skipped.length + '):');
    skipped.forEach(s => log('  - ' + s));
  }

  // Final pool counts
  log('\nFinal reactor pool counts:');
  for (const [name, addr] of Object.entries(REACTORS)) {
    if (!addr) { log('  ' + name + ': NOT DEPLOYED'); continue; }
    const r = new ethers.Contract(addr, REACTOR_ABI, provider);
    const c = await r.poolCount();
    log('  ' + name + ': ' + c.toString() + ' pools');
  }
}

main().catch(e => {
  console.error('Fatal:', e.shortMessage || e.message);
  process.exit(1);
});
