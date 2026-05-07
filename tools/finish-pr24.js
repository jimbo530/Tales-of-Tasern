/**
 * finish-pr24.js — Mint the 2 remaining PR24 positions (DDD + EGP)
 * and add them to the PR24 reactor.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const PR24 = '0xd84415C956F44b2300a2E56c5B898401913e9A29';
const PR24_DEC = 18;
const PR24_USD = 11.0;
const SAVE_FOR_PR25 = ethers.parseUnits('6', PR24_DEC);

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const REACTOR = '0x2502Bc4a3E64938E26F418Aa04399A31eF2C0c6e';
const FEE = 10000;

const REMAINING = [
  { name: 'DDD', addr: '0x4bf82cf0d6b2afc87367052b793097153c859d38', dec: 18, usd: 0.00047221 },
  { name: 'EGP', addr: '0x64f6f111e9fdb753877f17f399b759de97379170', dec: 18, usd: 0.00018123 },
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
const REACTOR_ABI = ['function addPool(uint256) external', 'function poolCount() view returns (uint256)'];

function log(msg) { console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gas() {
  const fee = await p.getFeeData();
  return { maxFeePerGas: fee.maxFeePerGas * 2n, maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n };
}

async function main() {
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  const reactor = new ethers.Contract(REACTOR, REACTOR_ABI, wallet);
  const pr24C = new ethers.Contract(PR24, ERC20_ABI, wallet);

  const startCount = await reactor.poolCount();
  log('PR24 reactor: ' + startCount.toString() + ' pools');

  const totalPr24 = await pr24C.balanceOf(wallet.address);
  const usable = totalPr24 - SAVE_FOR_PR25;
  const pr24PerPos = usable / BigInt(REMAINING.length);
  log('PR24 balance: ' + Number(ethers.formatUnits(totalPr24, 18)).toFixed(4));
  log('Usable (minus 6 saved): ' + Number(ethers.formatUnits(usable, 18)).toFixed(4));
  log('Per position: ' + Number(ethers.formatUnits(pr24PerPos, 18)).toFixed(4) + ' PR24');

  for (const nation of REMAINING) {
    log('\n--- PR24/' + nation.name + ' ---');

    const pr24Bal = await pr24C.balanceOf(wallet.address);
    const pr24Use = pr24Bal - SAVE_FOR_PR25 > pr24PerPos ? pr24PerPos : pr24Bal - SAVE_FOR_PR25;
    if (pr24Use <= 0n) {
      log('SKIP -- no PR24 left');
      continue;
    }

    const pr24UsdVal = Number(ethers.formatUnits(pr24Use, PR24_DEC)) * PR24_USD;
    const nationTokens = pr24UsdVal / nation.usd;
    const nationAmount = ethers.parseUnits(Math.floor(nationTokens).toString(), nation.dec);

    const nationC = new ethers.Contract(nation.addr, ERC20_ABI, wallet);
    const nationBal = await nationC.balanceOf(wallet.address);
    const nationUse = nationBal < nationAmount ? nationBal : nationAmount;

    log('PR24: ' + Number(ethers.formatUnits(pr24Use, PR24_DEC)).toFixed(4) + ' ($' + pr24UsdVal.toFixed(2) + ')');
    log(nation.name + ': ' + Number(ethers.formatUnits(nationUse, nation.dec)).toLocaleString() + ' ($' + (Number(ethers.formatUnits(nationUse, nation.dec)) * nation.usd).toFixed(2) + ')');

    // Mint position
    const pr24Lower = PR24.toLowerCase() < nation.addr.toLowerCase();
    const token0 = pr24Lower ? PR24 : nation.addr;
    const token1 = pr24Lower ? nation.addr : PR24;
    const amount0 = pr24Lower ? pr24Use : nationUse;
    const amount1 = pr24Lower ? nationUse : pr24Use;

    const deadline = Math.floor(Date.now() / 1000) + 600;
    log('Minting...');
    const tx = await npm.mint({
      token0, token1, fee: FEE,
      tickLower: -887200, tickUpper: 887200,
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

    // addPool
    log('Adding pool...');
    const tx3 = await reactor.addPool(tokenId, await gas());
    await tx3.wait();
    const count = await reactor.poolCount();
    log('addPool done -- PR24 reactor: ' + count.toString() + ' pools');

    if (REMAINING.indexOf(nation) < REMAINING.length - 1) {
      log('Waiting 2 min...');
      await sleep(120000);
    }
  }

  const finalCount = await reactor.poolCount();
  const pr24Left = await pr24C.balanceOf(wallet.address);
  log('\n=== DONE ===');
  log('PR24 reactor: ' + finalCount.toString() + ' pools');
  log('PR24 remaining: ' + Number(ethers.formatUnits(pr24Left, 18)).toFixed(4) + ' (saved for PR25)');
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
