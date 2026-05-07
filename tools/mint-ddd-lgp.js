/**
 * mint-ddd-lgp.js — Mint full-range DDD/LGP V3 position, transfer to reactor, register
 *
 * Steps: approve DDD, approve LGP, mint position, transfer to reactor, addPool()
 * Each step waits for user confirmation via command line args:
 *   node mint-ddd-lgp.js approve
 *   node mint-ddd-lgp.js mint
 *   node mint-ddd-lgp.js transfer
 *   node mint-ddd-lgp.js addpool
 *   node mint-ddd-lgp.js status
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const LGP = '0xddc330761761751e005333208889bfe36c6e6760';
const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const REACTOR = '0x0d8389435abACD28410AD240613572E3d3573ADE';
const FEE = 10000; // 1%
const TICK_SPACING = 200;
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
  'function ownerOf(uint256) view returns (address)',
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
];

const REACTOR_ABI = [
  'function addPool(uint256,address) external',
  'function poolCount() view returns (uint256)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
];

const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)'];
const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const ddd = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const lgp = new ethers.Contract(LGP, ERC20_ABI, wallet);
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);

  if (cmd === 'status') {
    const dddBal = await ddd.balanceOf(wallet.address);
    const lgpBal = await lgp.balanceOf(wallet.address);
    log('Wallet: ' + wallet.address);
    log('DDD: ' + Number(ethers.formatEther(dddBal)).toLocaleString());
    log('LGP: ' + Number(ethers.formatEther(lgpBal)).toLocaleString());

    const dddAllow = await ddd.allowance(wallet.address, NPM);
    const lgpAllow = await lgp.allowance(wallet.address, NPM);
    log('DDD allowance to NPM: ' + (dddAllow > 0n ? 'YES' : 'NO'));
    log('LGP allowance to NPM: ' + (lgpAllow > 0n ? 'YES' : 'NO'));

    // Pool price
    const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
    const poolAddr = await factory.getPool(DDD, LGP, FEE);
    const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);
    const slot0 = await pool.slot0();
    const tick = Number(slot0[1]);
    const sqrtP = Number(slot0[0]) / (2 ** 96);
    const price = sqrtP * sqrtP;
    log('Pool: ' + poolAddr);
    log('Tick: ' + tick + ' | 1 DDD = ' + price.toFixed(4) + ' LGP');
    return;
  }

  if (cmd === 'approve') {
    log('Approving DDD to NPM...');
    const tx1 = await ddd.approve(NPM, ethers.MaxUint256);
    await tx1.wait();
    log('DDD approved. tx: ' + tx1.hash);

    log('Approving LGP to NPM...');
    const tx2 = await lgp.approve(NPM, ethers.MaxUint256);
    await tx2.wait();
    log('LGP approved. tx: ' + tx2.hash);
    return;
  }

  if (cmd === 'mint') {
    // Get balances
    const lgpBal = await lgp.balanceOf(wallet.address);
    const dddBal = await ddd.balanceOf(wallet.address);
    log('Minting full-range DDD/LGP position');
    log('DDD available: ' + Number(ethers.formatEther(dddBal)).toLocaleString());
    log('LGP available: ' + Number(ethers.formatEther(lgpBal)).toLocaleString());

    // DDD is token0 (lower address)
    const amount0 = dddBal; // offer all DDD, contract takes what it needs
    const amount1 = lgpBal; // offer all LGP

    const deadline = Math.floor(Date.now() / 1000) + 600;

    const tx = await npm.mint({
      token0: DDD,
      token1: LGP,
      fee: FEE,
      tickLower: TICK_LOW,
      tickUpper: TICK_HIGH,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: 0n,
      amount1Min: 0n,
      recipient: wallet.address,
      deadline: deadline,
    });

    log('Mint tx sent: ' + tx.hash);
    const receipt = await tx.wait();
    log('Gas used: ' + receipt.gasUsed.toString());

    // Parse tokenId from Transfer event
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const mintLog = receipt.logs.find(l =>
      l.address.toLowerCase() === NPM.toLowerCase() &&
      l.topics[0] === transferTopic
    );
    if (mintLog) {
      const tokenId = BigInt(mintLog.topics[3]);
      log('Position NFT minted! tokenId: ' + tokenId.toString());
    }

    // Final balances
    const dddAfter = await ddd.balanceOf(wallet.address);
    const lgpAfter = await lgp.balanceOf(wallet.address);
    log('DDD remaining: ' + Number(ethers.formatEther(dddAfter)).toLocaleString());
    log('LGP remaining: ' + Number(ethers.formatEther(lgpAfter)).toLocaleString());
    return;
  }

  if (cmd === 'transfer') {
    const tokenId = process.argv[3];
    if (!tokenId) { log('Usage: transfer <tokenId>'); return; }
    log('Transferring tokenId ' + tokenId + ' to reactor ' + REACTOR);
    const tx = await npm.safeTransferFrom(wallet.address, REACTOR, tokenId);
    await tx.wait();
    log('Transferred. tx: ' + tx.hash);
    return;
  }

  if (cmd === 'addpool') {
    const tokenId = process.argv[3];
    if (!tokenId) { log('Usage: addpool <tokenId>'); return; }
    const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);
    // LGP is the "other" token (not DDD, which is the reactor's native token)
    log('Calling addPool(' + tokenId + ', ' + LGP + ')');
    const tx = await reactor.addPool(tokenId, LGP);
    await tx.wait();
    log('Pool registered. tx: ' + tx.hash);
    const count = await reactor.poolCount();
    log('Total pools in reactor: ' + count.toString());
    return;
  }

  log('Unknown command: ' + cmd);
  log('Commands: status, approve, mint, transfer <id>, addpool <id>');
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
