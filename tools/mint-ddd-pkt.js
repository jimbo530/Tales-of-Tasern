/**
 * mint-ddd-pkt.js — Mint full-range DDD/PKT V3 position, transfer to reactor, register
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const PKT = '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a';
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

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const ddd = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const pkt = new ethers.Contract(PKT, ERC20_ABI, wallet);
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);

  // Step 1: Approvals
  const pktAllow = await pkt.allowance(wallet.address, NPM);
  if (pktAllow < ethers.parseEther('200000')) {
    log('Approving PKT to NPM...');
    const tx = await pkt.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('PKT approved. tx: ' + tx.hash);
  } else {
    log('PKT already approved.');
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

  // Step 2: Mint — all PKT + matching DDD
  const dddBal = await ddd.balanceOf(wallet.address);
  const pktBal = await pkt.balanceOf(wallet.address);
  log('DDD balance: ' + Number(ethers.formatEther(dddBal)).toLocaleString());
  log('PKT balance: ' + Number(ethers.formatEther(pktBal)).toLocaleString());

  // DDD is token0 (lower address)
  log('Minting full-range DDD/PKT position...');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await npm.mint({
    token0: DDD, token1: PKT, fee: FEE,
    tickLower: TICK_LOW, tickUpper: TICK_HIGH,
    amount0Desired: dddBal, amount1Desired: pktBal,
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
  const pktAfter = await pkt.balanceOf(wallet.address);
  log('DDD remaining: ' + Number(ethers.formatEther(dddAfter)).toLocaleString());
  log('PKT remaining: ' + Number(ethers.formatEther(pktAfter)).toLocaleString());

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
