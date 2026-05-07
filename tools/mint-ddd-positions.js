/**
 * mint-ddd-positions.js — Create V3 positions for DDD Nation Reactor
 *
 * Uses the balancer wallet to mint V3 position NFTs on Polygon.
 * Single-sided DDD positions above current tick for pools without X-token balance.
 * Two-sided for DDD/LGP (we hold both).
 *
 * Commands:
 *   status                — show all pool states + balances
 *   mint <PAIR> <DDD_AMT> — mint position (e.g. mint EGP 150000)
 *   mint-all              — mint all 4 healthy pairs with auto-split
 *   transfer <ID> <TO>    — transfer position NFT to reactor
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK  = process.env.BALANCER_PRIVATE_KEY;

if (!PK) { console.error('No BALANCER_PRIVATE_KEY in tools/.env'); process.exit(1); }

// ── Addresses ───────────────────────────────────────────────────────────────
const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const TOKENS = {
  EGP: '0x64f6f111e9fdb753877f17f399b759de97379170',
  OGC: '0xccf37622e6b72352e7b410481dd4913563038b7c',
  IGS: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce',
  BTN: '0xd7c584d40216576f1d8651eab8bef9de69497666',
  LGP: '0xddc330761761751e005333208889bfe36c6e6760',
  DHG: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a',
  PKT: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a',
};

const V3_POOLS = {
  EGP: '0xfDfB8EAFeD40D37435722087F9AA4Ff446fb1916',
  OGC: '0x1eCeAC707A748179c686DD1B68D0002a24B00340',
  IGS: '0x2a79b3fba8fAe65513672527b9fC3156a728d259',
  BTN: '0xB192B1556760c19fB4299995693AF4b8E0526c83',
  LGP: '0x272D77d3438cC662fdfa7fCe8124f1A21dF48217',
  DHG: '0x19de041daA2fCA3cC94fA110572338BEd45dCF4C',
  PKT: '0x1416dAa82D10b52B5Fc7a2b2Fe0321bE62468117',
};

const FEE = 10000;        // 1% fee tier
const TICK_SPACING = 200; // for 1% fee

// Healthy pools — these have reasonable prices
const HEALTHY = ['EGP', 'OGC', 'LGP', 'PKT'];

// ── ABIs ────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
  'function liquidity() view returns (uint128)',
];

const NPM_ABI = [
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function safeTransferFrom(address from, address to, uint256 tokenId) external',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

// Round tick DOWN to nearest tick spacing
function tickFloor(tick) {
  return Math.floor(tick / TICK_SPACING) * TICK_SPACING;
}

// Round tick UP to nearest tick spacing
function tickCeil(tick) {
  return Math.ceil(tick / TICK_SPACING) * TICK_SPACING;
}

async function getPoolState(name, provider) {
  const pool = new ethers.Contract(V3_POOLS[name], POOL_ABI, provider);
  const [sqrtPriceX96, tick] = await pool.slot0();
  const liq = await pool.liquidity();
  const price = Number(sqrtPriceX96) ** 2 / (2 ** 192);
  return { tick: Number(tick), liquidity: liq, xPerDDD: price, sqrtPriceX96 };
}

// ── Status ──────────────────────────────────────────────────────────────────
async function cmdStatus(wallet, provider) {
  console.log('Balancer wallet: ' + wallet.address);
  const pol = await provider.getBalance(wallet.address);
  console.log('POL: ' + ethers.formatEther(pol));

  const dddC = new ethers.Contract(DDD, ERC20_ABI, provider);
  const dddBal = await dddC.balanceOf(wallet.address);
  console.log('DDD: ' + Number(ethers.formatEther(dddBal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));

  // Check LGP balance too
  const lgpC = new ethers.Contract(TOKENS.LGP, ERC20_ABI, provider);
  const lgpBal = await lgpC.balanceOf(wallet.address);
  console.log('LGP: ' + Number(ethers.formatEther(lgpBal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));

  console.log('\nV3 Pool States (1% fee, DDD is always token0):');
  console.log('-'.repeat(70));

  for (const name of Object.keys(TOKENS)) {
    try {
      const state = await getPoolState(name, provider);
      const healthy = state.tick > -100000 && state.xPerDDD > 0.001;
      const flag = healthy ? '' : ' << BROKEN PRICE';
      const liqStr = state.liquidity > 0n ? state.liquidity.toString() : '0';
      console.log(
        ('DDD/' + name).padEnd(10) +
        ' tick=' + state.tick.toString().padStart(8) +
        '  xPerDDD=' + state.xPerDDD.toFixed(4).padStart(8) +
        '  liq=' + liqStr.padStart(12) +
        flag
      );
    } catch (e) {
      console.log(('DDD/' + name).padEnd(10) + ' ERROR: ' + (e.shortMessage || e.message).slice(0, 50));
    }
  }
}

// ── Mint single position ────────────────────────────────────────────────────
async function cmdMint(wallet, provider, pairName, dddAmount) {
  const name = pairName.toUpperCase();
  if (!TOKENS[name]) {
    console.error('Unknown token: ' + pairName + '. Known: ' + Object.keys(TOKENS).join(', '));
    process.exit(1);
  }

  const state = await getPoolState(name, provider);
  log('DDD/' + name + ' — tick=' + state.tick + ' xPerDDD=' + state.xPerDDD.toFixed(4));

  if (state.tick < -100000) {
    log('WARNING: Pool has broken price (tick ' + state.tick + '). Skipping.');
    log('IGS/BTN/DHG need price correction first.');
    return null;
  }

  const dddWei = ethers.parseEther(dddAmount.toString());

  // Check balance
  const dddC = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const bal = await dddC.balanceOf(wallet.address);
  if (bal < dddWei) {
    log('Not enough DDD. Have: ' + ethers.formatEther(bal) + ', need: ' + dddAmount);
    return null;
  }

  // Single-sided DDD position: range ABOVE current tick
  // DDD is token0, so providing only token0 means range above current price
  const tickLower = tickCeil(state.tick);  // just above current tick
  const tickUpper = tickLower + 40000;     // wide range above

  // Cap tickUpper at max
  const maxTick = 887200;
  const finalUpper = Math.min(tickUpper, maxTick);

  log('Position range: tickLower=' + tickLower + ' tickUpper=' + finalUpper);
  log('Providing ' + dddAmount + ' DDD (single-sided, no X-token needed)');

  // Approve NPM
  const allowance = await dddC.allowance(wallet.address, NPM);
  if (allowance < dddWei) {
    log('Approving NPM for DDD...');
    const appTx = await dddC.approve(NPM, ethers.MaxUint256);
    await appTx.wait();
  }

  // For DDD/LGP, check if we should do two-sided
  let xAmount = 0n;
  if (name === 'LGP') {
    const lgpC = new ethers.Contract(TOKENS.LGP, ERC20_ABI, wallet);
    const lgpBal = await lgpC.balanceOf(wallet.address);
    if (lgpBal > 0n) {
      xAmount = lgpBal;
      log('Also providing ' + Number(ethers.formatEther(lgpBal)).toFixed(0) + ' LGP (two-sided)');

      // Use full range for two-sided
      const twoSidedLower = tickFloor(state.tick) - 20000;
      const twoSidedUpper = tickCeil(state.tick) + 20000;

      const lgpAllow = await lgpC.allowance(wallet.address, NPM);
      if (lgpAllow < lgpBal) {
        log('Approving NPM for LGP...');
        const appTx2 = await lgpC.approve(NPM, ethers.MaxUint256);
        await appTx2.wait();
      }

      return await doMint(wallet, name, Math.max(twoSidedLower, -887200), Math.min(twoSidedUpper, 887200), dddWei, xAmount);
    }
  }

  return await doMint(wallet, name, tickLower, finalUpper, dddWei, 0n);
}

async function doMint(wallet, name, tickLower, tickUpper, dddWei, xWei) {
  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);

  const params = {
    token0: DDD,
    token1: TOKENS[name],
    fee: FEE,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: dddWei,    // DDD is token0
    amount1Desired: xWei,      // X-token
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 600,
  };

  log('Minting V3 position for DDD/' + name + '...');
  const tx = await npm.mint(params);
  log('Tx sent: ' + tx.hash);
  const receipt = await tx.wait();

  // Parse the tokenId from the Transfer event
  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  const transferLog = receipt.logs.find(l => l.topics[0] === transferTopic && l.address.toLowerCase() === NPM.toLowerCase());

  let tokenId = null;
  if (transferLog && transferLog.topics.length >= 4) {
    tokenId = BigInt(transferLog.topics[3]).toString();
    log('Position NFT minted! tokenId=' + tokenId);
  } else {
    // Try IncreaseLiquidity event
    const ilTopic = ethers.id('IncreaseLiquidity(uint256,uint128,uint256,uint256)');
    const ilLog = receipt.logs.find(l => l.topics[0] === ilTopic);
    if (ilLog) {
      tokenId = BigInt(ilLog.topics[1]).toString();
      log('Position NFT minted! tokenId=' + tokenId);
    } else {
      log('Minted but could not parse tokenId. Check tx: ' + tx.hash);
    }
  }

  return tokenId;
}

// ── Mint all healthy pairs ──────────────────────────────────────────────────
async function cmdMintAll(wallet, provider) {
  const dddC = new ethers.Contract(DDD, ERC20_ABI, provider);
  const dddBal = await dddC.balanceOf(wallet.address);
  const totalDDD = Number(ethers.formatEther(dddBal));

  log('Total DDD available: ' + totalDDD.toLocaleString(undefined, { maximumFractionDigits: 0 }));

  // Split: 4 healthy pools
  const perPool = Math.floor(totalDDD / HEALTHY.length);
  log('Allocating ~' + perPool.toLocaleString() + ' DDD per pool (' + HEALTHY.length + ' pools)');
  console.log('Pools: ' + HEALTHY.join(', '));
  console.log('');

  const results = {};
  for (const name of HEALTHY) {
    log('--- DDD/' + name + ' ---');
    const tokenId = await cmdMint(wallet, provider, name, perPool);
    if (tokenId) {
      results[name] = tokenId;
    }
    console.log('');
  }

  console.log('\n=== Results ===');
  for (const [name, id] of Object.entries(results)) {
    console.log('DDD/' + name + '  tokenId=' + id);
  }
  console.log('\nSkipped (broken price): IGS, BTN, DHG');
  console.log('Next: transfer these NFTs to the reactor, then call addPool()');

  return results;
}

// ── Transfer position NFT to reactor ────────────────────────────────────────
async function cmdTransfer(wallet, tokenId, toAddr) {
  if (!ethers.isAddress(toAddr)) {
    console.error('Invalid address: ' + toAddr);
    process.exit(1);
  }

  const npm = new ethers.Contract(NPM, NPM_ABI, wallet);
  log('Transferring position #' + tokenId + ' to ' + toAddr);
  const tx = await npm.safeTransferFrom(wallet.address, toAddr, tokenId);
  await tx.wait();
  log('Transferred! tx: ' + tx.hash);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const cmd = process.argv[2];

  if (!cmd || cmd === 'status')  return cmdStatus(wallet, provider);
  if (cmd === 'mint-all')        return cmdMintAll(wallet, provider);
  if (cmd === 'mint') {
    const pair = process.argv[3];
    const amt = process.argv[4];
    if (!pair || !amt) { console.error('Usage: mint <PAIR> <DDD_AMOUNT>'); process.exit(1); }
    return cmdMint(wallet, provider, pair, Number(amt));
  }
  if (cmd === 'transfer') {
    const id = process.argv[3];
    const to = process.argv[4];
    if (!id || !to) { console.error('Usage: transfer <TOKEN_ID> <REACTOR_ADDR>'); process.exit(1); }
    return cmdTransfer(wallet, id, to);
  }

  console.log([
    '', 'DDD Nation — V3 Position Minter',
    '',
    'Commands:',
    '  status                — pool states + wallet balances',
    '  mint <PAIR> <DDD_AMT> — mint single position (e.g. mint EGP 150000)',
    '  mint-all              — mint all 4 healthy pairs, auto-split DDD',
    '  transfer <ID> <TO>    — send position NFT to reactor',
    '',
    'Healthy pairs: ' + HEALTHY.join(', '),
    'Broken (need price fix): IGS, BTN, DHG',
    '',
  ].join('\n'));
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
