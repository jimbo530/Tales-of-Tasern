/**
 * mint-ddd-usdc.js — Create DDD/USDC V3 pool, mint full-range position, add to reactor
 * USDC is 6 decimals. USDC(0x3c) < DDD(0x4b) so USDC=token0, DDD=token1.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD  = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const NPM  = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const REACTOR = '0x0d8389435abACD28410AD240613572E3d3573ADE';
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE = 10000;
const TICK_LOW = -887200;
const TICK_HIGH = 887200;

// USDC is token0 (lower address), DDD is token1
const TOKEN0 = USDC;
const TOKEN1 = DDD;

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const FACTORY_ABI = [
  'function createPool(address,address,uint24) returns (address)',
  'function getPool(address,address,uint24) view returns (address)',
];
const POOL_ABI = [
  'function initialize(uint160) external',
  'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
];
const NPM_ABI = [
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
  'function safeTransferFrom(address,address,uint256)',
];
const REACTOR_ABI = [
  'function addPool(uint256) external',
  'function poolCount() view returns (uint256)',
];
const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
];

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, wallet);
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  const ddd = new ethers.Contract(DDD, ERC20_ABI, wallet);

  // Get DDD price from V2 USDGLO pair
  const usdgloPair = new ethers.Contract('0x7eE2dd0022e3460177B90b8F8fa3b3a76D970FF6', PAIR_ABI, provider);
  const [r0, r1] = await usdgloPair.getReserves();
  const t0 = (await usdgloPair.token0()).toLowerCase();
  const dddIs0 = t0 === DDD.toLowerCase();
  const dddRes = Number(ethers.formatEther(dddIs0 ? r0 : r1));
  const usdRes = Number(ethers.formatEther(dddIs0 ? r1 : r0));
  const dddPrice = usdRes / dddRes;
  log('DDD price: $' + dddPrice.toFixed(8));

  // Calculate sqrtPriceX96: USDC=token0(6dec), DDD=token1(18dec)
  // price = token1_raw/token0_raw = (DDD_raw)/(USDC_raw) = 10^12 / dddPrice
  const priceRaw = 1e12 / dddPrice;
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(priceRaw) * (2 ** 96)));
  log('sqrtPriceX96: ' + sqrtPriceX96.toString());

  // Step 1: Create pool
  let poolAddr = await factory.getPool(USDC, DDD, FEE);
  if (poolAddr === ethers.ZeroAddress) {
    log('Creating DDD/USDC 1% pool...');
    const tx = await factory.createPool(USDC, DDD, FEE);
    await tx.wait();
    poolAddr = await factory.getPool(USDC, DDD, FEE);
    log('Pool created: ' + poolAddr);
  } else {
    log('Pool already exists: ' + poolAddr);
  }

  // Step 2: Initialize
  const pool = new ethers.Contract(poolAddr, POOL_ABI, wallet);
  try {
    const slot0 = await pool.slot0();
    if (slot0[0] === 0n) {
      log('Initializing pool...');
      const tx = await pool.initialize(sqrtPriceX96);
      await tx.wait();
      log('Pool initialized');
    } else {
      log('Pool already initialized, tick: ' + slot0[1]);
    }
  } catch (e) {
    log('Initializing pool...');
    const tx = await pool.initialize(sqrtPriceX96);
    await tx.wait();
    log('Pool initialized');
  }

  // Step 3: Approvals
  const usdcAllow = await usdc.allowance(wallet.address, NPM);
  if (usdcAllow < ethers.parseUnits('10', 6)) {
    log('Approving USDC to NPM...');
    const tx = await usdc.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('USDC approved');
  }
  const dddAllow = await ddd.allowance(wallet.address, NPM);
  if (dddAllow < ethers.parseEther('30000')) {
    log('Approving DDD to NPM...');
    const tx = await ddd.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('DDD approved');
  }

  // Step 4: Mint — 10 USDC + offer all DDD (contract takes what it needs)
  const usdcBal = await usdc.balanceOf(wallet.address);
  const dddBal = await ddd.balanceOf(wallet.address);
  const usdcAmount = ethers.parseUnits('10', 6); // 10 USDC
  log('USDC balance: ' + Number(ethers.formatUnits(usdcBal, 6)).toLocaleString());
  log('DDD balance: ' + Number(ethers.formatEther(dddBal)).toLocaleString());

  log('Minting full-range USDC/DDD position: 10 USDC + matching DDD...');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await npm.mint({
    token0: TOKEN0, token1: TOKEN1, fee: FEE,
    tickLower: TICK_LOW, tickUpper: TICK_HIGH,
    amount0Desired: usdcAmount,  // USDC = token0
    amount1Desired: dddBal,      // DDD = token1, offer all
    amount0Min: 0n, amount1Min: 0n,
    recipient: wallet.address, deadline,
  });
  log('Mint tx: ' + tx.hash);
  const receipt = await tx.wait();
  log('Gas: ' + receipt.gasUsed.toString());

  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const mintLog = receipt.logs.find(l =>
    l.address.toLowerCase() === NPM.toLowerCase() && l.topics[0] === transferTopic
  );
  const tokenId = BigInt(mintLog.topics[3]);
  log('Position minted! tokenId: ' + tokenId.toString());

  const usdcAfter = await usdc.balanceOf(wallet.address);
  const dddAfter = await ddd.balanceOf(wallet.address);
  log('USDC remaining: ' + Number(ethers.formatUnits(usdcAfter, 6)).toLocaleString());
  log('DDD remaining: ' + Number(ethers.formatEther(dddAfter)).toLocaleString());

  // Step 5: Transfer to reactor
  log('Transferring tokenId ' + tokenId + ' to reactor...');
  const tx2 = await npm.safeTransferFrom(wallet.address, REACTOR, tokenId);
  await tx2.wait();
  log('Transferred. tx: ' + tx2.hash);

  // Step 6: addPool
  log('Registering via addPool...');
  const tx3 = await reactor.addPool(tokenId);
  await tx3.wait();
  log('Registered. tx: ' + tx3.hash);
  const count = await reactor.poolCount();
  log('Total reactor pools: ' + count.toString());

  log('=== Done ===');
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
