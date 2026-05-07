/**
 * mint-btn-positions.js — Mint full-range BTN/X V3 positions, transfer to BTN reactor, register
 * BTN is 8 decimals. 100K BTN per position.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const BTN = '0xd7c584d40216576f1d8651eab8bef9de69497666';
const BTN_DEC = 8;
const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const BTN_REACTOR = '0x2b35C282c21cE95C6050254318044DF530079521';
const FEE = 10000;
const TICK_LOW = -887200;
const TICK_HIGH = 887200;
const BTN_AMOUNT = ethers.parseUnits('100000', BTN_DEC);

const PAIRS = [
  { name: 'DDD', addr: '0x4bf82cf0d6b2afc87367052b793097153c859d38', dec: 18 },
  { name: 'EGP', addr: '0x64f6f111e9fdb753877f17f399b759de97379170', dec: 18 },
  { name: 'OGC', addr: '0xccf37622e6b72352e7b410481dd4913563038b7c', dec: 18 },
  { name: 'IGS', addr: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', dec: 8 },
  { name: 'PKT', addr: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', dec: 18 },
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
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const reactor = new ethers.Contract(BTN_REACTOR, REACTOR_ABI, wallet);
  const btnC = new ethers.Contract(BTN, ERC20_ABI, wallet);

  // Approve BTN to NPM
  const btnAllow = await btnC.allowance(wallet.address, NPM);
  if (btnAllow < BTN_AMOUNT * 5n) {
    log('Approving BTN to NPM...');
    const tx = await btnC.approve(NPM, ethers.MaxUint256);
    await tx.wait();
    log('BTN approved');
  }

  for (const pair of PAIRS) {
    log('');
    log('=== BTN/' + pair.name + ' ===');

    const xC = new ethers.Contract(pair.addr, ERC20_ABI, wallet);

    // Approve opposing token
    const xAllow = await xC.allowance(wallet.address, NPM);
    if (xAllow < ethers.parseUnits('1000000', pair.dec)) {
      log('Approving ' + pair.name + ' to NPM...');
      const tx = await xC.approve(NPM, ethers.MaxUint256);
      await tx.wait();
      log(pair.name + ' approved');
    }

    // Get balance of opposing token
    const xBal = await xC.balanceOf(wallet.address);
    log(pair.name + ' balance: ' + Number(ethers.formatUnits(xBal, pair.dec)).toLocaleString());

    // Determine token order: lower address = token0
    const btnLower = BTN.toLowerCase() < pair.addr.toLowerCase();
    const token0 = btnLower ? BTN : pair.addr;
    const token1 = btnLower ? pair.addr : BTN;
    const amount0 = btnLower ? BTN_AMOUNT : xBal;
    const amount1 = btnLower ? xBal : BTN_AMOUNT;

    log('token0: ' + (btnLower ? 'BTN' : pair.name) + ' | token1: ' + (btnLower ? pair.name : 'BTN'));

    // Mint
    log('Minting full-range position: 100K BTN + matching ' + pair.name + '...');
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
      log('Gas: ' + receipt.gasUsed.toString());

      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const mintLog = receipt.logs.find(l =>
        l.address.toLowerCase() === NPM.toLowerCase() && l.topics[0] === transferTopic
      );
      const tokenId = BigInt(mintLog.topics[3]);
      log('Position minted! tokenId: ' + tokenId.toString());

      // Transfer to reactor
      log('Transferring to BTN reactor...');
      const tx2 = await npm.safeTransferFrom(wallet.address, BTN_REACTOR, tokenId);
      await tx2.wait();
      log('Transferred');

      // Register
      log('Calling addPool...');
      const tx3 = await reactor.addPool(tokenId);
      await tx3.wait();
      log('Registered. tx: ' + tx3.hash);
    } catch (e) {
      log('ERROR: ' + (e.shortMessage || e.message).slice(0, 120));
    }
  }

  const count = await reactor.poolCount();
  log('');
  log('=== BTN Reactor: ' + count.toString() + ' pools ===');
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
