/**
 * mint-ddd-egp.js — Mint full-range DDD/EGP V3 position, transfer to reactor, register
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const EGP = '0x64f6f111e9fdb753877f17f399b759de97379170';
const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
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
const REACTOR_ABI = [
  'function addPool(uint256) external',
  'function poolCount() view returns (uint256)',
];
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)'];
const POOL_ABI = ['function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)', 'function token0() view returns (address)'];
const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const ddd = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const egp = new ethers.Contract(EGP, ERC20_ABI, wallet);
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);

  // Check pool exists and get token order
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const poolAddr = await factory.getPool(DDD, EGP, FEE);
  if (poolAddr === ethers.ZeroAddress) {
    log('ERROR: DDD/EGP 1% pool does not exist');
    return;
  }
  const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
  const t0 = await pool.token0();
  const slot0 = await pool.slot0();
  log('Pool: ' + poolAddr + ' | tick: ' + slot0[1]);
  log('token0: ' + (t0.toLowerCase() === DDD.toLowerCase() ? 'DDD' : 'EGP'));

  // Determine token order for mint
  const dddIsToken0 = t0.toLowerCase() === DDD.toLowerCase();
  const token0 = dddIsToken0 ? DDD : EGP;
  const token1 = dddIsToken0 ? EGP : DDD;

  // Step 1: Approvals
  const egpAllow = await egp.allowance(wallet.address, NPM);
  if (egpAllow < ethers.parseEther('300000')) {
    log('Approving EGP to NPM...');
    const tx = await egp.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('EGP approved. tx: ' + tx.hash);
  } else {
    log('EGP already approved.');
  }

  const dddAllow = await ddd.allowance(wallet.address, NPM);
  if (dddAllow < ethers.parseEther('200000')) {
    log('Approving DDD to NPM...');
    const tx = await ddd.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('DDD approved. tx: ' + tx.hash);
  } else {
    log('DDD already approved.');
  }

  // Step 2: Mint
  const dddBal = await ddd.balanceOf(wallet.address);
  const egpBal = await egp.balanceOf(wallet.address);
  log('DDD balance: ' + Number(ethers.formatEther(dddBal)).toLocaleString());
  log('EGP balance: ' + Number(ethers.formatEther(egpBal)).toLocaleString());

  // Offer all EGP + plenty of DDD, contract takes what it needs
  const amount0 = dddIsToken0 ? dddBal : egpBal;
  const amount1 = dddIsToken0 ? egpBal : dddBal;

  log('Minting full-range DDD/EGP position...');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await npm.mint({
    token0, token1, fee: FEE,
    tickLower: TICK_LOW, tickUpper: TICK_HIGH,
    amount0Desired: amount0, amount1Desired: amount1,
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

  const dddAfter = await ddd.balanceOf(wallet.address);
  const egpAfter = await egp.balanceOf(wallet.address);
  log('DDD remaining: ' + Number(ethers.formatEther(dddAfter)).toLocaleString());
  log('EGP remaining: ' + Number(ethers.formatEther(egpAfter)).toLocaleString());

  // Step 3: Transfer
  log('Transferring tokenId ' + tokenId + ' to reactor...');
  const tx2 = await npm.safeTransferFrom(wallet.address, REACTOR, tokenId);
  await tx2.wait();
  log('Transferred. tx: ' + tx2.hash);

  // Step 4: addPool
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
