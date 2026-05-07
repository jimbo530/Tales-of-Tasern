/**
 * add-wbtc-to-ogc-reactor.js — Add WBTC pool to existing OGC reactor
 * Run: node add-wbtc-to-ogc-reactor.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const OGC = '0xccf37622e6b72352e7b410481dd4913563038b7c';
const OGC_DEC = 18;
const OGC_USD = 0.00026;

const WBTC = '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6';
const WBTC_DEC = 8;
const WBTC_USD = 76050;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0xDFF8c75f825e757923fF8f0dE83F814e02fDe5B4';
const FEE = 10000;
const TICK_LOW = -887200;
const TICK_HIGH = 887200;

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
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)', 'function createPool(address,address,uint24) returns (address)'];
const POOL_ABI = ['function initialize(uint160 sqrtPriceX96)', 'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)'];

function log(msg) { console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg); }

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

async function main() {
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);
  const ogcC = new ethers.Contract(OGC, ERC20_ABI, wallet);
  const wbtcC = new ethers.Contract(WBTC, ERC20_ABI, wallet);

  const ogcBal = await ogcC.balanceOf(wallet.address);
  const wbtcBal = await wbtcC.balanceOf(wallet.address);
  const startCount = await reactor.poolCount();

  log('Wallet: ' + wallet.address);
  log('OGC reactor: ' + REACTOR + ' (' + startCount.toString() + ' pools)');
  log('WBTC: ' + ethers.formatUnits(wbtcBal, 8) + ' ($' + (Number(ethers.formatUnits(wbtcBal, 8)) * WBTC_USD).toFixed(2) + ')');
  log('OGC: ' + Number(ethers.formatEther(ogcBal)).toLocaleString());

  if (wbtcBal === 0n) { log('ERROR: No WBTC'); process.exit(1); }

  // Match OGC to WBTC value
  const wbtcUsdVal = Number(ethers.formatUnits(wbtcBal, 8)) * WBTC_USD;
  const ogcNeeded = wbtcUsdVal / OGC_USD;
  const ogcAmount = ethers.parseUnits(Math.floor(ogcNeeded).toString(), OGC_DEC);
  const ogcUse = ogcBal < ogcAmount ? ogcBal : ogcAmount;

  log('OGC to use: ' + Number(ethers.formatEther(ogcUse)).toLocaleString() + ' ($' + (Number(ethers.formatEther(ogcUse)) * OGC_USD).toFixed(2) + ')');

  // Approvals
  log('\n=== APPROVALS ===');
  const ogcAllow = await ogcC.allowance(wallet.address, NPM);
  if (ogcAllow < ogcUse) {
    log('Approving OGC...');
    const tx = await ogcC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  const wbtcAllow = await wbtcC.allowance(wallet.address, NPM);
  if (wbtcAllow < wbtcBal) {
    log('Approving WBTC...');
    const tx = await wbtcC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  log('Approvals done');

  // Ensure pool exists and is initialized
  log('\n=== POOL ===');
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(OGC, WBTC, FEE);

  if (poolAddr === ZERO) {
    log('Creating V3 1% pool...');
    const tx = await factory.createPool(OGC, WBTC, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(OGC, WBTC, FEE);
    log('Pool: ' + poolAddr);
  } else {
    log('Pool exists: ' + poolAddr);
  }

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      const ogcIsT0 = OGC.toLowerCase() < WBTC.toLowerCase();
      const usd0 = ogcIsT0 ? OGC_USD : WBTC_USD;
      const dec0 = ogcIsT0 ? OGC_DEC : WBTC_DEC;
      const usd1 = ogcIsT0 ? WBTC_USD : OGC_USD;
      const dec1 = ogcIsT0 ? WBTC_DEC : OGC_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('Initialized');
    } else {
      log('Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    const ogcIsT0 = OGC.toLowerCase() < WBTC.toLowerCase();
    const usd0 = ogcIsT0 ? OGC_USD : WBTC_USD;
    const dec0 = ogcIsT0 ? OGC_DEC : WBTC_DEC;
    const usd1 = ogcIsT0 ? WBTC_USD : OGC_USD;
    const dec1 = ogcIsT0 ? WBTC_DEC : OGC_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('Initialized');
  }

  // Mint position
  log('\n=== MINT ===');
  const ogcIsT0 = OGC.toLowerCase() < WBTC.toLowerCase();
  const token0 = ogcIsT0 ? OGC : WBTC;
  const token1 = ogcIsT0 ? WBTC : OGC;
  const amount0 = ogcIsT0 ? ogcUse : wbtcBal;
  const amount1 = ogcIsT0 ? wbtcBal : ogcUse;

  const deadline = Math.floor(Date.now() / 1000) + 600;
  log('Minting OGC/WBTC position...');
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
  const finalCount = await reactor.poolCount();
  log('addPool done — OGC reactor: ' + finalCount.toString() + ' pools');

  log('\n========================================');
  log('OGC REACTOR: ' + REACTOR);
  log('WBTC pool added — position #' + tokenId.toString());
  log('Pools: ' + finalCount.toString());
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
