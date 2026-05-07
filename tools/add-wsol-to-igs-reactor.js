/**
 * add-wsol-to-igs-reactor.js — Add WSOL pool to existing IGS reactor
 * Run: node add-wsol-to-igs-reactor.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const IGS = '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce';
const IGS_DEC = 8;
const IGS_USD = 0.00018;

const WSOL = '0xd93f7E271cB87c23AaA73edC008A79646d1F9912';
const WSOL_DEC = 9;
const WSOL_USD = 83;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0x8e662E4b7f5e33DfC5F73E8A67b34E9e147825AA';
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
  const igsC = new ethers.Contract(IGS, ERC20_ABI, wallet);
  const wsolC = new ethers.Contract(WSOL, ERC20_ABI, wallet);

  const igsBal = await igsC.balanceOf(wallet.address);
  const wsolBal = await wsolC.balanceOf(wallet.address);
  const startCount = await reactor.poolCount();

  log('Wallet: ' + wallet.address);
  log('IGS reactor: ' + REACTOR + ' (' + startCount.toString() + ' pools)');
  log('WSOL: ' + ethers.formatUnits(wsolBal, WSOL_DEC) + ' ($' + (Number(ethers.formatUnits(wsolBal, WSOL_DEC)) * WSOL_USD).toFixed(2) + ')');
  log('IGS: ' + Number(ethers.formatUnits(igsBal, IGS_DEC)).toLocaleString());

  if (wsolBal === 0n) { log('ERROR: No WSOL'); process.exit(1); }

  // Match IGS to WSOL value
  const wsolUsdVal = Number(ethers.formatUnits(wsolBal, WSOL_DEC)) * WSOL_USD;
  const igsNeeded = wsolUsdVal / IGS_USD;
  const igsAmount = ethers.parseUnits(Math.floor(igsNeeded).toString(), IGS_DEC);
  const igsUse = igsBal < igsAmount ? igsBal : igsAmount;

  log('IGS to use: ' + Number(ethers.formatUnits(igsUse, IGS_DEC)).toLocaleString() + ' ($' + (Number(ethers.formatUnits(igsUse, IGS_DEC)) * IGS_USD).toFixed(2) + ')');

  // Approvals
  log('\n=== APPROVALS ===');
  const igsAllow = await igsC.allowance(wallet.address, NPM);
  if (igsAllow < igsUse) {
    log('Approving IGS...');
    const tx = await igsC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  const wsolAllow = await wsolC.allowance(wallet.address, NPM);
  if (wsolAllow < wsolBal) {
    log('Approving WSOL...');
    const tx = await wsolC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  log('Approvals done');

  // Ensure pool exists and is initialized
  log('\n=== POOL ===');
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(IGS, WSOL, FEE);

  if (poolAddr === ZERO) {
    log('Creating V3 1% pool...');
    const tx = await factory.createPool(IGS, WSOL, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(IGS, WSOL, FEE);
    log('Pool: ' + poolAddr);
  } else {
    log('Pool exists: ' + poolAddr);
  }

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      const igsIsT0 = IGS.toLowerCase() < WSOL.toLowerCase();
      const usd0 = igsIsT0 ? IGS_USD : WSOL_USD;
      const dec0 = igsIsT0 ? IGS_DEC : WSOL_DEC;
      const usd1 = igsIsT0 ? WSOL_USD : IGS_USD;
      const dec1 = igsIsT0 ? WSOL_DEC : IGS_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('Initialized');
    } else {
      log('Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    const igsIsT0 = IGS.toLowerCase() < WSOL.toLowerCase();
    const usd0 = igsIsT0 ? IGS_USD : WSOL_USD;
    const dec0 = igsIsT0 ? IGS_DEC : WSOL_DEC;
    const usd1 = igsIsT0 ? WSOL_USD : IGS_USD;
    const dec1 = igsIsT0 ? WSOL_DEC : IGS_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('Initialized');
  }

  // Mint position
  log('\n=== MINT ===');
  const igsIsT0 = IGS.toLowerCase() < WSOL.toLowerCase();
  const token0 = igsIsT0 ? IGS : WSOL;
  const token1 = igsIsT0 ? WSOL : IGS;
  const amount0 = igsIsT0 ? igsUse : wsolBal;
  const amount1 = igsIsT0 ? wsolBal : igsUse;

  const deadline = Math.floor(Date.now() / 1000) + 600;
  log('Minting IGS/WSOL position...');
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
  log('addPool done — IGS reactor: ' + finalCount.toString() + ' pools');

  log('\n========================================');
  log('IGS REACTOR: ' + REACTOR);
  log('WSOL pool added — position #' + tokenId.toString());
  log('Pools: ' + finalCount.toString());
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
