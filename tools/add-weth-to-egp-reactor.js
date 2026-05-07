/**
 * add-weth-to-egp-reactor.js — Add WETH pool to existing EGP reactor
 * Run: node add-weth-to-egp-reactor.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const EGP = '0x64f6f111e9fdb753877f17f399b759de97379170';
const EGP_DEC = 18;
const EGP_USD = 0.0002;

const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
const WETH_DEC = 18;
const WETH_USD = 2290;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0xA4756770d5366F11DE43BF620C21098A54de76dA';
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
  const egpC = new ethers.Contract(EGP, ERC20_ABI, wallet);
  const wethC = new ethers.Contract(WETH, ERC20_ABI, wallet);

  const egpBal = await egpC.balanceOf(wallet.address);
  const wethBal = await wethC.balanceOf(wallet.address);
  const startCount = await reactor.poolCount();

  log('Wallet: ' + wallet.address);
  log('EGP reactor: ' + REACTOR + ' (' + startCount.toString() + ' pools)');
  log('WETH: ' + ethers.formatEther(wethBal) + ' ($' + (Number(ethers.formatEther(wethBal)) * WETH_USD).toFixed(2) + ')');
  log('EGP: ' + Number(ethers.formatEther(egpBal)).toLocaleString());

  if (wethBal === 0n) { log('ERROR: No WETH'); process.exit(1); }

  // Match EGP to WETH value
  const wethUsdVal = Number(ethers.formatEther(wethBal)) * WETH_USD;
  const egpNeeded = wethUsdVal / EGP_USD;
  const egpAmount = ethers.parseUnits(Math.floor(egpNeeded).toString(), EGP_DEC);
  const egpUse = egpBal < egpAmount ? egpBal : egpAmount;

  log('EGP to use: ' + Number(ethers.formatEther(egpUse)).toLocaleString() + ' ($' + (Number(ethers.formatEther(egpUse)) * EGP_USD).toFixed(2) + ')');

  // Approvals
  log('\n=== APPROVALS ===');
  const egpAllow = await egpC.allowance(wallet.address, NPM);
  if (egpAllow < egpUse) {
    log('Approving EGP...');
    const tx = await egpC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  const wethAllow = await wethC.allowance(wallet.address, NPM);
  if (wethAllow < wethBal) {
    log('Approving WETH...');
    const tx = await wethC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  log('Approvals done');

  // Ensure pool exists and is initialized
  log('\n=== POOL ===');
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(EGP, WETH, FEE);

  if (poolAddr === ZERO) {
    log('Creating V3 1% pool...');
    const tx = await factory.createPool(EGP, WETH, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(EGP, WETH, FEE);
    log('Pool: ' + poolAddr);
  } else {
    log('Pool exists: ' + poolAddr);
  }

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      const egpIsT0 = EGP.toLowerCase() < WETH.toLowerCase();
      const usd0 = egpIsT0 ? EGP_USD : WETH_USD;
      const dec0 = egpIsT0 ? EGP_DEC : WETH_DEC;
      const usd1 = egpIsT0 ? WETH_USD : EGP_USD;
      const dec1 = egpIsT0 ? WETH_DEC : EGP_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('Initialized');
    } else {
      log('Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    const egpIsT0 = EGP.toLowerCase() < WETH.toLowerCase();
    const usd0 = egpIsT0 ? EGP_USD : WETH_USD;
    const dec0 = egpIsT0 ? EGP_DEC : WETH_DEC;
    const usd1 = egpIsT0 ? WETH_USD : EGP_USD;
    const dec1 = egpIsT0 ? WETH_DEC : EGP_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('Initialized');
  }

  // Mint position
  log('\n=== MINT ===');
  const egpIsT0 = EGP.toLowerCase() < WETH.toLowerCase();
  const token0 = egpIsT0 ? EGP : WETH;
  const token1 = egpIsT0 ? WETH : EGP;
  const amount0 = egpIsT0 ? egpUse : wethBal;
  const amount1 = egpIsT0 ? wethBal : egpUse;

  const deadline = Math.floor(Date.now() / 1000) + 600;
  log('Minting EGP/WETH position...');
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
  log('addPool done — EGP reactor: ' + finalCount.toString() + ' pools');

  log('\n========================================');
  log('EGP REACTOR: ' + REACTOR);
  log('WETH pool added — position #' + tokenId.toString());
  log('Pools: ' + finalCount.toString());
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
