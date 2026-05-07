/**
 * finish-pr25.js — Mint remaining PR25 positions (IGS, BTN, PKT, and optionally EGP)
 * Pools already created by build-pr25-reactor.js. Just need positions + addPool.
 * Run: node finish-pr25.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const PR25 = '0x72e4327f592e9cb09d5730a55d1d68de144af53c';
const PR25_DEC = 10;
const PR25_USD = 11.0;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0x515f63B570674FA5a6722CD01a15dDbb7F2091F5';
const FEE = 10000;
const TICK_LOW = -887200;
const TICK_HIGH = 887200;

// Remaining pairs — uncomment EGP when tokens are available
const REMAINING = [
  { name: 'IGS', addr: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', dec: 8,  usd: 0.00018373 },
  { name: 'BTN', addr: '0xd7c584d40216576f1d8651eab8bef9de69497666', dec: 8,  usd: 0.00017708 },
  { name: 'PKT', addr: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', dec: 18, usd: 0.00025383 },
  // { name: 'EGP', addr: '0x64f6f111e9fdb753877f17f399b759de97379170', dec: 18, usd: 0.00018123 },
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const NPM_ABI = [
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function safeTransferFrom(address,address,uint256)',
];
const REACTOR_ABI = ['function addPool(uint256) external', 'function poolCount() view returns (uint256)'];
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)'];
const POOL_ABI = ['function initialize(uint160 sqrtPriceX96)', 'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)'];

function log(msg) { console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gas() {
  const fee = await p.getFeeData();
  return { maxFeePerGas: fee.maxFeePerGas * 2n, maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n };
}

function calcSqrtPriceX96(usd0, dec0, usd1, dec1) {
  const priceFloat = (usd0 / usd1) * Math.pow(10, dec1 - dec0);
  const sqrtPrice = Math.sqrt(priceFloat);
  const Q96 = 2n ** 96n;
  const scaled = BigInt(Math.round(sqrtPrice * 1e18));
  return (scaled * Q96) / BigInt(1e18);
}

async function ensurePoolReady(factory, pairAddr, pairDec, pairUsd) {
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(PR25, pairAddr, FEE);

  // Create pool if missing
  if (poolAddr === ZERO) {
    log('  Creating V3 1% pool...');
    const tx = await factory.createPool(PR25, pairAddr, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(PR25, pairAddr, FEE);
    log('  Pool: ' + poolAddr);
  } else {
    log('  Pool exists: ' + poolAddr);
  }

  if (poolAddr === ZERO) {
    throw new Error('Pool creation failed — address still zero');
  }

  // Check if initialized (slot0.sqrtPriceX96 > 0)
  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      // Need to initialize
      const pr25IsT0 = PR25.toLowerCase() < pairAddr.toLowerCase();
      const usd0 = pr25IsT0 ? PR25_USD : pairUsd;
      const dec0 = pr25IsT0 ? PR25_DEC : pairDec;
      const usd1 = pr25IsT0 ? pairUsd : PR25_USD;
      const dec1 = pr25IsT0 ? pairDec : PR25_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('  Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('  Initialized');
    } else {
      log('  Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    // slot0 might revert if not initialized on some implementations
    const pr25IsT0 = PR25.toLowerCase() < pairAddr.toLowerCase();
    const usd0 = pr25IsT0 ? PR25_USD : pairUsd;
    const dec0 = pr25IsT0 ? PR25_DEC : pairDec;
    const usd1 = pr25IsT0 ? pairUsd : PR25_USD;
    const dec1 = pr25IsT0 ? pairDec : PR25_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('  Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('  Initialized');
  }
}

async function main() {
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);
  const pr25C = new ethers.Contract(PR25, ERC20_ABI, wallet);

  const startCount = await reactor.poolCount();
  const pr25Bal = await pr25C.balanceOf(wallet.address);
  log('Wallet: ' + wallet.address);
  log('PR25 reactor: ' + startCount.toString() + ' pools');
  log('PR25 balance: ' + Number(ethers.formatUnits(pr25Bal, PR25_DEC)).toFixed(4));
  log('Pairs to mint: ' + REMAINING.length);

  if (pr25Bal === 0n) {
    log('ERROR: No PR25 tokens');
    process.exit(1);
  }

  const pr25PerPos = pr25Bal / BigInt(REMAINING.length);

  // Approvals
  log('\n=== APPROVALS ===');
  const pr25Allow = await pr25C.allowance(wallet.address, NPM);
  if (pr25Allow < pr25Bal) {
    log('Approving PR25...');
    const tx = await pr25C.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  for (const pair of REMAINING) {
    const c = new ethers.Contract(pair.addr, ERC20_ABI, wallet);
    const bal = await c.balanceOf(wallet.address);
    if (bal === 0n) continue;
    const allow = await c.allowance(wallet.address, NPM);
    if (allow < bal) {
      log('Approving ' + pair.name + '...');
      const tx = await c.approve(NPM, ethers.MaxUint256, await gas());
      await tx.wait();
    }
  }
  log('Approvals done');

  // Mint positions
  log('\n=== MINTING ===');
  let minted = 0;

  for (const pair of REMAINING) {
    log('\n--- PR25/' + pair.name + ' ---');

    const currentPr25 = await pr25C.balanceOf(wallet.address);
    const pr25Use = currentPr25 > pr25PerPos ? pr25PerPos : currentPr25;
    if (pr25Use <= 0n) {
      log('SKIP — no PR25 left');
      continue;
    }

    const pr25UsdVal = Number(ethers.formatUnits(pr25Use, PR25_DEC)) * PR25_USD;
    const pairTokens = pr25UsdVal / pair.usd;
    const pairAmount = ethers.parseUnits(Math.floor(pairTokens).toString(), pair.dec);

    const pairC = new ethers.Contract(pair.addr, ERC20_ABI, wallet);
    const pairBal = await pairC.balanceOf(wallet.address);
    if (pairBal === 0n) {
      log('SKIP — zero ' + pair.name);
      continue;
    }
    const pairUse = pairBal < pairAmount ? pairBal : pairAmount;

    log('PR25: ' + Number(ethers.formatUnits(pr25Use, PR25_DEC)).toFixed(4) + ' ($' + pr25UsdVal.toFixed(2) + ')');
    log(pair.name + ': ' + Number(ethers.formatUnits(pairUse, pair.dec)).toLocaleString() + ' ($' + (Number(ethers.formatUnits(pairUse, pair.dec)) * pair.usd).toFixed(2) + ')');

    try {
      // Ensure pool is created and initialized
      await ensurePoolReady(factory, pair.addr, pair.dec, pair.usd);

      // Token ordering
      const pr25Lower = PR25.toLowerCase() < pair.addr.toLowerCase();
      const token0 = pr25Lower ? PR25 : pair.addr;
      const token1 = pr25Lower ? pair.addr : PR25;
      const amount0 = pr25Lower ? pr25Use : pairUse;
      const amount1 = pr25Lower ? pairUse : pr25Use;

      // Mint
      const deadline = Math.floor(Date.now() / 1000) + 600;
      log('Minting...');
      const tx = await npm.mint({
        token0, token1, fee: FEE,
        tickLower: TICK_LOW, tickUpper: TICK_HIGH,
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
      log('MINTED #' + tokenId.toString() + ' | gas=' + receipt.gasUsed.toString());

      // Transfer to reactor
      log('Transferring to reactor...');
      const tx2 = await npm.safeTransferFrom(wallet.address, REACTOR, tokenId, await gas());
      await tx2.wait();
      log('Transferred');

      // Register
      log('Adding pool...');
      const tx3 = await reactor.addPool(tokenId, await gas());
      await tx3.wait();
      const count = await reactor.poolCount();
      log('addPool done — PR25 reactor: ' + count.toString() + ' pools');
      minted++;

      if (REMAINING.indexOf(pair) < REMAINING.length - 1) {
        log('Waiting 2 min...');
        await sleep(120000);
      }
    } catch (e) {
      log('ERROR: ' + (e.shortMessage || e.message).slice(0, 200));
    }
  }

  const pr25Left = await pr25C.balanceOf(wallet.address);
  const finalCount = await reactor.poolCount();
  log('\n========================================');
  log('PR25 REACTOR: ' + REACTOR);
  log('Pools: ' + finalCount.toString());
  log('Minted this run: ' + minted + '/' + REMAINING.length);
  log('PR25 remaining: ' + Number(ethers.formatUnits(pr25Left, PR25_DEC)).toFixed(4));
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
