/**
 * add-usdt-to-ddd-reactor.js — Add USDT pool to existing DDD reactor
 * Run: node add-usdt-to-ddd-reactor.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const DDD_DEC = 18;
const DDD_USD = 0.00046;

const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const USDT_DEC = 6;
const USDT_USD = 1.00;

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const REACTOR = '0x0d8389435abACD28410AD240613572E3d3573ADE';
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
  const dddC = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const usdtC = new ethers.Contract(USDT, ERC20_ABI, wallet);

  const dddBal = await dddC.balanceOf(wallet.address);
  const usdtBal = await usdtC.balanceOf(wallet.address);
  const startCount = await reactor.poolCount();

  log('Wallet: ' + wallet.address);
  log('DDD reactor: ' + REACTOR + ' (' + startCount.toString() + ' pools)');
  log('USDT: ' + ethers.formatUnits(usdtBal, USDT_DEC) + ' ($' + Number(ethers.formatUnits(usdtBal, USDT_DEC)).toFixed(2) + ')');
  log('DDD: ' + Number(ethers.formatEther(dddBal)).toLocaleString());

  if (usdtBal === 0n) { log('ERROR: No USDT'); process.exit(1); }

  // Match DDD to USDT value
  const usdtUsdVal = Number(ethers.formatUnits(usdtBal, USDT_DEC)) * USDT_USD;
  const dddNeeded = usdtUsdVal / DDD_USD;
  const dddAmount = ethers.parseUnits(Math.floor(dddNeeded).toString(), DDD_DEC);
  const dddUse = dddBal < dddAmount ? dddBal : dddAmount;

  log('DDD to use: ' + Number(ethers.formatEther(dddUse)).toLocaleString() + ' ($' + (Number(ethers.formatEther(dddUse)) * DDD_USD).toFixed(2) + ')');

  // Approvals
  log('\n=== APPROVALS ===');
  const dddAllow = await dddC.allowance(wallet.address, NPM);
  if (dddAllow < dddUse) {
    log('Approving DDD...');
    const tx = await dddC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  const usdtAllow = await usdtC.allowance(wallet.address, NPM);
  if (usdtAllow < usdtBal) {
    log('Approving USDT...');
    const tx = await usdtC.approve(NPM, ethers.MaxUint256, await gas());
    await tx.wait();
  }
  log('Approvals done');

  // Ensure pool exists and is initialized
  log('\n=== POOL ===');
  const ZERO = '0x0000000000000000000000000000000000000000';
  let poolAddr = await factory.getPool(DDD, USDT, FEE);

  if (poolAddr === ZERO) {
    log('Creating V3 1% pool...');
    const tx = await factory.createPool(DDD, USDT, FEE, await gas());
    await tx.wait();
    poolAddr = await factory.getPool(DDD, USDT, FEE);
    log('Pool: ' + poolAddr);
  } else {
    log('Pool exists: ' + poolAddr);
  }

  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      const dddIsT0 = DDD.toLowerCase() < USDT.toLowerCase();
      const usd0 = dddIsT0 ? DDD_USD : USDT_USD;
      const dec0 = dddIsT0 ? DDD_DEC : USDT_DEC;
      const usd1 = dddIsT0 ? USDT_USD : DDD_USD;
      const dec1 = dddIsT0 ? USDT_DEC : DDD_DEC;
      const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
      log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
      const tx = await pool.initialize(sqrtPrice, await gas());
      await tx.wait();
      log('Initialized');
    } else {
      log('Already initialized (sqrtPrice: ' + slot0[0].toString() + ')');
    }
  } catch (e) {
    const dddIsT0 = DDD.toLowerCase() < USDT.toLowerCase();
    const usd0 = dddIsT0 ? DDD_USD : USDT_USD;
    const dec0 = dddIsT0 ? DDD_DEC : USDT_DEC;
    const usd1 = dddIsT0 ? USDT_USD : DDD_USD;
    const dec1 = dddIsT0 ? USDT_DEC : DDD_DEC;
    const sqrtPrice = calcSqrtPriceX96(usd0, dec0, usd1, dec1);
    log('Initializing sqrtPriceX96: ' + sqrtPrice.toString());
    const tx = await pool.initialize(sqrtPrice, await gas());
    await tx.wait();
    log('Initialized');
  }

  // Mint position
  log('\n=== MINT ===');
  const dddIsT0 = DDD.toLowerCase() < USDT.toLowerCase();
  const token0 = dddIsT0 ? DDD : USDT;
  const token1 = dddIsT0 ? USDT : DDD;
  const amount0 = dddIsT0 ? dddUse : usdtBal;
  const amount1 = dddIsT0 ? usdtBal : dddUse;

  const deadline = Math.floor(Date.now() / 1000) + 600;
  log('Minting DDD/USDT position...');
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
  log('addPool done — DDD reactor: ' + finalCount.toString() + ' pools');

  log('\n========================================');
  log('DDD REACTOR: ' + REACTOR);
  log('USDT pool added — position #' + tokenId.toString());
  log('Pools: ' + finalCount.toString());
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
