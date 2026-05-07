/**
 * add-wpol-to-dhg-reactor.js — Add WPOL pool to existing DHG reactor
 * Run: node add-wpol-to-dhg-reactor.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const DHG = '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a';
const DHG_DEC = 8;
const DHG_USD = 0.00018;

const WPOL = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
const WPOL_DEC = 18;
const WPOL_USD = 0.09;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0x4ce08087953cb06C14A8Cd7cCEb130377762C170';
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
  const dhgC = new ethers.Contract(DHG, ERC20_ABI, wallet);
  const wpolC = new ethers.Contract(WPOL, ERC20_ABI, wallet);

  const dhgBal = await dhgC.balanceOf(wallet.address);
  const wpolBal = await wpolC.balanceOf(wallet.address);
  const startCount = await reactor.poolCount();

  log('Wallet: ' + wallet.address);
  log('DHG reactor: ' + REACTOR + ' (' + startCount.toString() + ' pools)');
  log('WPOL: ' + ethers.formatEther(wpolBal) + ' ($' + (Number(ethers.formatEther(wpolBal)) * WPOL_USD).toFixed(2) + ')');
  log('DHG: ' + Number(ethers.formatUnits(dhgBal, DHG_DEC)).toLocaleString());

  if (wpolBal === 0n) { log('ERROR: No WPOL'); process.exit(1); }

  // Match DHG to WPOL value
  const wpolUsdVal = Number(ethers.formatEther(wpolBal)) * WPOL_USD;
  const dhgNeeded = wpolUsdVal / DHG_USD;
  const dhgAmount = ethers.parseUnits(Math.floor(dhgNeeded).toString(), DHG_DEC);
  const dhgUse = dhgBal < dhgAmount ? dhgBal : dhgAmount;

  log('DHG to use: ' + Number(ethers.formatUnits(dhgUse, DHG_DEC)).toLocaleString() + ' ($' + (Number(ethers.formatUnits(dhgUse, DHG_DEC)) * DHG_USD).toFixed(2) + ')');

  // Approvals
  log('\n=== APPROVALS ===');
  const dhgAllow = await dhgC.allowance(wallet.address, NPM);
  if (dhgAllow < dhgUse) {
    log('Approving DHG...');
    const tx = await dhgC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  const wpolAllow = await wpolC.allowance(wallet.address, NPM);
  if (wpolAllow < wpolBal) {
    log('Approving WPOL...');
    const tx = await wpolC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  log('Approvals done');

  // Ensure pool exists and is initialized
  log('\n=== POOL ===');
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(DHG, WPOL, FEE);

  if (poolAddr === ZERO) {
    log('Creating V3 1% pool...');
    const tx = await factory.createPool(DHG, WPOL, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(DHG, WPOL, FEE);
    log('Pool: ' + poolAddr);
  } else {
    log('Pool exists: ' + poolAddr);
  }

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      const dhgIsT0 = DHG.toLowerCase() < WPOL.toLowerCase();
      const usd0 = dhgIsT0 ? DHG_USD : WPOL_USD;
      const dec0 = dhgIsT0 ? DHG_DEC : WPOL_DEC;
      const usd1 = dhgIsT0 ? WPOL_USD : DHG_USD;
      const dec1 = dhgIsT0 ? WPOL_DEC : DHG_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('Initialized');
    } else {
      log('Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    const dhgIsT0 = DHG.toLowerCase() < WPOL.toLowerCase();
    const usd0 = dhgIsT0 ? DHG_USD : WPOL_USD;
    const dec0 = dhgIsT0 ? DHG_DEC : WPOL_DEC;
    const usd1 = dhgIsT0 ? WPOL_USD : DHG_USD;
    const dec1 = dhgIsT0 ? WPOL_DEC : DHG_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('Initialized');
  }

  // Mint position
  log('\n=== MINT ===');
  const dhgIsT0 = DHG.toLowerCase() < WPOL.toLowerCase();
  const token0 = dhgIsT0 ? DHG : WPOL;
  const token1 = dhgIsT0 ? WPOL : DHG;
  const amount0 = dhgIsT0 ? dhgUse : wpolBal;
  const amount1 = dhgIsT0 ? wpolBal : dhgUse;

  const deadline = Math.floor(Date.now() / 1000) + 600;
  log('Minting DHG/WPOL position...');
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
  log('addPool done — DHG reactor: ' + finalCount.toString() + ' pools');

  log('\n========================================');
  log('DHG REACTOR: ' + REACTOR);
  log('WPOL pool added — position #' + tokenId.toString());
  log('Pools: ' + finalCount.toString());
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
