/**
 * tasern-balancer.js — Tasern D20 token rebalancer on Polygon
 *
 * Sells highest-value game token, buys lowest-value.
 * Keeps total balance at 1M tokens, skims excess to owner.
 * 5% dead zone — won't swap if prices are already close.
 *
 * Commands:
 *   balance              — wallet + token balances
 *   prices               — USDC prices for all 8 tokens
 *   once                 — one rebalance cycle
 *   run [seconds]        — continuous loop (default 120s)
 *   approve              — approve router for all tokens
 *   send <TOKEN> <to> <n>— transfer tokens
 */

const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');

require('dotenv').config({ path: envPath });

let ethers;
try {
  ethers = require('ethers');
} catch {
  console.error('ethers not installed. Run: cd tools && npm install');
  process.exit(1);
}

// --- Auto-generate wallet if no key ---
if (!process.env.BALANCER_PRIVATE_KEY) {
  const wallet = ethers.Wallet.createRandom();
  const envContent = [
    '# Tasern Balancer Wallet',
    '# Auto-generated — DO NOT COMMIT',
    'BALANCER_PRIVATE_KEY=' + wallet.privateKey,
    'OWNER_ADDRESS=',
    '# POLYGON_RPC=https://polygon-rpc.com',
    '',
  ].join('\n');
  fs.writeFileSync(envPath, envContent);
  console.log('Generated new Tasern Balancer wallet');
  console.log('Address: ' + wallet.address);
  console.log('Key saved to tools/.env');
  console.log('');
  console.log('Next steps:');
  console.log('1. Add your OWNER_ADDRESS to tools/.env');
  console.log('2. Fund ' + wallet.address + ' with:');
  console.log('   - 1,000,000 DDD tokens');
  console.log('   - Some POL for gas (~0.5 POL)');
  console.log('3. Run: node tasern-balancer.js approve');
  console.log('4. Run: node tasern-balancer.js run');
  process.exit(0);
}

// --- Config ---
const RPC        = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK         = process.env.REBALANCER_PRIVATE_KEY || process.env.BALANCER_PRIVATE_KEY;
const OWNER      = process.env.OWNER_ADDRESS;
const SWAP_TOKENS = 10_000;      // 10,000 tokens per swap
const DEAD_ZONE  = 5;            // 5% minimum spread
const TOTAL_CAP  = 1_000_000;    // 1M total tokens across all 8
const CAP_WEI    = ethers.parseEther(TOTAL_CAP.toString());
const LOOP_SEC   = 120;          // default loop interval

// Uniswap V2 on Polygon
const ROUTER_ADDR  = '0xedf6066a2b290C185783862C7F4776A2C8077AD1';
const FACTORY_ADDR = '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C';

// Uniswap V3 on Polygon — swaps route here to feed DDD reactor fees
const V3_ROUTER    = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'; // SwapRouter02
const V3_FEE       = 10000; // 1% fee tier (matches reactor positions)

// USDGLO stablecoin ~ $1 (18 decimals)
const USDGLO = '0x4f604735c1cf31399c6e711d5962b2b3e0225ad3';

// ─── 8 Game Tokens (Polygon, all 18 decimals) ───────────────────────────────
const TOKENS = {
  DDD: { addr: '0x4bf82cf0d6b2afc87367052b793097153c859d38', decimals: 18 },
  EGP: { addr: '0x64f6f111e9fdb753877f17f399b759de97379170', decimals: 18 },
  OGC: { addr: '0xccf37622e6b72352e7b410481dd4913563038b7c', decimals: 18 },
  IGS: { addr: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', decimals: 8 },
  BTN: { addr: '0xd7c584d40216576f1d8651eab8bef9de69497666', decimals: 8 },
  LGP: { addr: '0xddc330761761751e005333208889bfe36c6e6760', decimals: 18 },
  DHG: { addr: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a', decimals: 8 },
  PKT: { addr: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', decimals: 18 },
};

// ─── USDGLO LP pairs for pricing (factory-agnostic reserve reads) ────────────
const USDGLO_PAIRS = {
  DDD: '0x7eE2dd0022e3460177B90b8F8fa3b3a76D970FF6',
  EGP: '0xEb5b6e6AC30fB8949269a88814925B2639eede4b',
  OGC: '0xcb8ecb17365ad243f64839aea81f40679e0c8c9a',
  IGS: '0x61646724babcdeb4f70683a5b7c46d2bde506ee8',
  BTN: '0xc174118B4e8009F525a0464744d4BFEA30F67D9d',
  LGP: '0x395106988f425dC4c85b1997b7063cFe38C64278',
  PKT: '0x2be03aca43921852d389c65ae82bb9c2f3069f11',
};
// CCC fallback pairs — used when USDGLO pair is drained
// CCC connects to 7 of 8 game tokens (no IGS) + USDGLO
const CCC_GAME_PAIRS = {
  DDD: '0x73e6a1630486d0874ec56339327993a3e4684691',
  EGP: '0xbcd50f1c7f28bc5712ac03c5a18ff0d46ce6bff5',
  OGC: '0x3dd8cb68cbe0eb3e57707a3d1f136ff245d829fd',
  PKT: '0xad199d493327f5655b4e2f4a7c4e930a73ad226f',
  BTN: '0x2e49bb80e4255cdc32551a718444444d42994032',
  DHG: '0xef7a39205c45e4aa8a3d784c96088ea9a6d35596',
  LGP: '0xdb916d0e476b6263c9f910e17373574747d4c471',
};
const CCC_USDGLO_PAIR = '0xa4817dc7bdfdde18e54e4f0bcfa84d632eefb377';

// Minimum game-token reserve for a price to be reliable (< 1 token = drained)
const MIN_RESERVE = ethers.parseEther('1');

// ─── ABIs ────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
];

const PAIR_ABI = [
  'function getReserves() view returns (uint112, uint112, uint32)',
  'function token0() view returns (address)',
];

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
  'function factory() view returns (address)',
];

const V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256 amountOut)',
];

// ─── State (cached on startup) ───────────────────────────────────────────────
// Maps LP address -> true if game token (or CCC) is token0
const pairOrder = {};
let cccAddr = null;

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

// ─── Init: cache token0 ordering for all price pairs ─────────────────────────
async function initPricing(provider) {
  log('Initializing price pairs...');

  const tasks = [];

  // Cache USDGLO pairs — game token vs USDGLO
  for (const [name, pairAddr] of Object.entries(USDGLO_PAIRS)) {
    tasks.push((async () => {
      const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
      const t0 = (await pair.token0()).toLowerCase();
      pairOrder[pairAddr] = t0 === TOKENS[name].addr.toLowerCase();
    })());
  }

  // Cache CCC game pairs — game token vs CCC
  // Also discover CCC address from the first pair
  for (const [name, pairAddr] of Object.entries(CCC_GAME_PAIRS)) {
    tasks.push((async () => {
      const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
      const t0 = (await pair.token0()).toLowerCase();
      const tokenLow = TOKENS[name].addr.toLowerCase();
      pairOrder[pairAddr] = t0 === tokenLow;
      // Discover CCC address (the non-game-token side)
      if (!cccAddr && t0 !== tokenLow) cccAddr = t0;
    })());
  }

  // Cache CCC/USDGLO pair
  tasks.push((async () => {
    const pair = new ethers.Contract(CCC_USDGLO_PAIR, PAIR_ABI, provider);
    const t0 = (await pair.token0()).toLowerCase();
    // CCC sorts lower than USDGLO, so CCC is likely token0
    // We'll set this after cccAddr is discovered
    pairOrder['_ccc_usdglo_t0'] = t0;
  })());

  await Promise.all(tasks);

  // Finalize CCC/USDGLO pair ordering
  if (cccAddr) {
    pairOrder[CCC_USDGLO_PAIR] = pairOrder['_ccc_usdglo_t0'] === cccAddr;
  } else {
    // CCC was always token1 in game pairs — discover from CCC/USDGLO
    const t0 = pairOrder['_ccc_usdglo_t0'];
    const usdgloLow = USDGLO.toLowerCase();
    cccAddr = t0 === usdgloLow ? null : t0; // if USDGLO is token0, CCC is token1
    pairOrder[CCC_USDGLO_PAIR] = t0 !== usdgloLow;
  }
  delete pairOrder['_ccc_usdglo_t0'];

  log('Price pairs ready (' + Object.keys(pairOrder).length + ' pairs, CCC=' + (cccAddr || 'unknown').slice(0, 10) + ')');
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
// Read price from LP reserves. Returns price of token in quote.
// pairOrder[addr] = true means the token we're pricing is token0.
// Returns 0 if token reserve is below MIN_RESERVE (drained pool).
async function getPairPrice(pairAddr, provider, tokenDecimals = 18, quoteDecimals = 18) {
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
  const [r0, r1] = await pair.getReserves();
  const isTokenFirst = pairOrder[pairAddr];
  const tokenRes = isTokenFirst ? r0 : r1;
  const quoteRes = isTokenFirst ? r1 : r0;
  const minRes = tokenDecimals === 18 ? MIN_RESERVE : ethers.parseUnits('1', tokenDecimals);
  if (tokenRes < minRes) return 0; // drained — unreliable
  const t = Number(ethers.formatUnits(tokenRes, tokenDecimals));
  const q = Number(ethers.formatUnits(quoteRes, quoteDecimals));
  if (t === 0) return 0;
  return q / t;
}

async function getAllPrices(provider) {
  const prices = {};

  // Step 1: Get CCC price from CCC/USDGLO pair
  let cccPrice = 0;
  try {
    cccPrice = await getPairPrice(CCC_USDGLO_PAIR, provider);
  } catch (e) {
    log('WARN CCC price: ' + (e.shortMessage || e.message).slice(0, 80));
  }

  // Step 2: Price each token — try USDGLO pair first, then CCC fallback
  const tasks = Object.keys(TOKENS).map(async (name) => {
    const dec = TOKENS[name].decimals;
    // Try USDGLO pair (USDGLO is 18 decimals)
    if (USDGLO_PAIRS[name]) {
      try {
        const p = await getPairPrice(USDGLO_PAIRS[name], provider, dec, 18);
        if (p > 0) { prices[name] = p; return; }
      } catch (e) {
        log('WARN USDGLO/' + name + ': ' + (e.shortMessage || e.message).slice(0, 60));
      }
    }

    // Try CCC fallback: (token per CCC) * (CCC per USDGLO)
    // CCC is 18 decimals
    if (CCC_GAME_PAIRS[name] && cccPrice > 0) {
      try {
        const inCcc = await getPairPrice(CCC_GAME_PAIRS[name], provider, dec, 18);
        if (inCcc > 0) { prices[name] = inCcc * cccPrice; return; }
      } catch (e) {
        log('WARN CCC/' + name + ': ' + (e.shortMessage || e.message).slice(0, 60));
      }
    }

    prices[name] = 0; // no reliable price source
  });

  await Promise.all(tasks);

  // Log unpriceable tokens once
  const dead = Object.entries(prices).filter(([, p]) => p === 0).map(([n]) => n);
  if (dead.length > 0) log('No price: ' + dead.join(', ') + ' (LPs drained)');

  return prices;
}

// ─── Balances ────────────────────────────────────────────────────────────────
async function getAllBalances(addr, provider) {
  const bals = {};
  await Promise.all(Object.entries(TOKENS).map(async ([name, info]) => {
    const c = new ethers.Contract(info.addr, ERC20_ABI, provider);
    bals[name] = await c.balanceOf(addr);
  }));
  return bals;
}

// ─── Swap via Uniswap V2 Router ──────────────────────────────────────────────
async function ensureApproval(tokenAddr, spender, wallet) {
  const c = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
  const allow = await c.allowance(wallet.address, spender);
  if (allow === 0n) {
    log('Approving ' + tokenAddr.slice(0, 10) + '... for router');
    const tx = await c.approve(spender, ethers.MaxUint256);
    await tx.wait();
  }
}

async function executeSwap(wallet, sellName, buyName, amountIn, provider) {
  const sellAddr = TOKENS[sellName].addr;
  const buyAddr  = TOKENS[buyName].addr;
  const sellDec  = TOKENS[sellName].decimals;
  const buyDec   = TOKENS[buyName].decimals;
  const dddAddr  = TOKENS.DDD.addr;

  // --- Try V3 first — prefer direct sell->buy pool (feeds sell token's reactor) ---
  await ensureApproval(sellAddr, V3_ROUTER, wallet);
  const v3router = new ethers.Contract(V3_ROUTER, V3_ROUTER_ABI, wallet);

  // 1. Direct V3: sell -> buy (fees go to sell/buy pool, benefits sell token's reactor)
  const feeData = await provider.getFeeData();
  const gasOverrides = {
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
  };
  try {
    const tx = await v3router.exactInputSingle({
      tokenIn: sellAddr, tokenOut: buyAddr, fee: V3_FEE,
      recipient: wallet.address, amountIn: amountIn,
      amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
    }, gasOverrides);
    const r = await tx.wait();
    log('Swapped V3 direct ' + sellName + '->' + buyName + ' | gas ' + r.gasUsed);
    return r;
  } catch (e) {
    log('  V3 direct failed: ' + (e.shortMessage || e.message).slice(0, 80));
  }

  // 2. Fallback: sell -> DDD -> buy (first hop still feeds sell token's reactor)
  const sellIsDDD = sellAddr.toLowerCase() === dddAddr.toLowerCase();
  const buyIsDDD  = buyAddr.toLowerCase()  === dddAddr.toLowerCase();
  if (!sellIsDDD && !buyIsDDD) {
    try {
      const path = ethers.solidityPacked(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [sellAddr, V3_FEE, dddAddr, V3_FEE, buyAddr]
      );
      const tx = await v3router.exactInput({
        path: path, recipient: wallet.address,
        amountIn: amountIn, amountOutMinimum: 0n,
      }, gasOverrides);
      const r = await tx.wait();
      log('Swapped V3 via DDD ' + sellName + '->' + buyName + ' | gas ' + r.gasUsed);
      return r;
    } catch (e) {
      log('  V3 via DDD failed: ' + (e.shortMessage || e.message).slice(0, 80));
    }
  }

  // --- V2 fallback ---
  log('  Falling back to V2...');
  await ensureApproval(sellAddr, ROUTER_ADDR, wallet);
  const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const paths = [[sellAddr, buyAddr]];
  if (!sellIsDDD && !buyIsDDD) {
    paths.push([sellAddr, dddAddr, buyAddr]);
  }

  for (const swapPath of paths) {
    const label = swapPath.length === 2 ? 'V2 direct' : 'V2 via DDD';
    try {
      const tx = await router.swapExactTokensForTokens(
        amountIn, 0n, swapPath, wallet.address, deadline, gasOverrides
      );
      const r = await tx.wait();
      log('Swapped ' + label + ' ' + sellName + '->' + buyName + ' | gas ' + r.gasUsed);
      return r;
    } catch (e) {
      log('  ' + label + ' failed: ' + (e.shortMessage || e.message).slice(0, 80));
    }
  }

  log('ERROR: All swap routes failed');
  return null;
}

// ─── Rebalance Cycle ─────────────────────────────────────────────────────────
async function rebalanceCycle(wallet, provider) {
  // Gas check
  const polBal = await provider.getBalance(wallet.address);
  if (polBal < ethers.parseEther('0.01')) {
    log('WARNING: Low POL balance (' + ethers.formatEther(polBal) + '). Need gas!');
  }

  // 1. Price all 8
  const prices = await getAllPrices(provider);
  const priced = Object.entries(prices).filter(([, p]) => p > 0);
  if (priced.length < 2) {
    log('Only ' + priced.length + ' tokens priced, need at least 2. Skipping.');
    return { swapped: false };
  }

  // 2. Rank highest to lowest
  priced.sort((a, b) => b[1] - a[1]);
  const [highName, highPrice] = priced[0];
  const [lowName, lowPrice]   = priced[priced.length - 1];

  log('Prices: ' + priced.map(([n, p]) => n + ' $' + p.toFixed(10)).join(' | '));

  // 3. Dead zone check
  if (lowPrice === 0) {
    log('Lowest price is 0, skipping.');
    return { swapped: false };
  }
  const spread = ((highPrice - lowPrice) / lowPrice) * 100;
  log('High: ' + highName + ' $' + highPrice.toFixed(10) + ' | Low: ' + lowName + ' $' + lowPrice.toFixed(10) + ' | Spread: ' + spread.toFixed(2) + '%');

  if (spread < DEAD_ZONE) {
    log('Spread ' + spread.toFixed(2) + '% < ' + DEAD_ZONE + '% dead zone. Markets balanced.');
    return { swapped: false };
  }

  // 4. Sell 10,000 tokens of highest-priced token
  const sellDec = TOKENS[highName].decimals;
  const tokensToSell = SWAP_TOKENS;
  const sellWei = ethers.parseUnits(tokensToSell.toString(), sellDec);

  // Balance check
  const sellContract = new ethers.Contract(TOKENS[highName].addr, ERC20_ABI, provider);
  const sellBal = await sellContract.balanceOf(wallet.address);
  if (sellBal < sellWei) {
    const have = Number(ethers.formatUnits(sellBal, sellDec)).toFixed(0);
    log('Not enough ' + highName + '. Have: ' + have + ', need: ' + tokensToSell.toFixed(0));
    return { swapped: false };
  }

  log('Selling ' + tokensToSell.toLocaleString() + ' ' + highName + ' for ' + lowName);

  // 5. Swap — V3 first (feeds DDD reactor), V2 fallback
  const result = await executeSwap(wallet, highName, lowName, sellWei, provider);
  if (!result) return { swapped: false };

  // 6. Skim excess over 1M total tokens (normalize all to 18-dec equivalent)
  const balances = await getAllBalances(wallet.address, provider);
  let totalNorm = 0n;
  for (const [name, bal] of Object.entries(balances)) {
    const dec = TOKENS[name].decimals;
    totalNorm += dec === 18 ? bal : bal * (10n ** BigInt(18 - dec));
  }

  const totalTokens = Number(ethers.formatEther(totalNorm));
  log('Total tokens: ' + totalTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' / ' + TOTAL_CAP.toLocaleString());

  if (totalNorm > CAP_WEI && OWNER) {
    const lowDec = TOKENS[lowName].decimals;
    const boughtBal = balances[lowName];
    const boughtNorm = lowDec === 18 ? boughtBal : boughtBal * (10n ** BigInt(18 - lowDec));
    const excessNorm = totalNorm - CAP_WEI;
    const toSendNorm = excessNorm < boughtNorm ? excessNorm : boughtNorm;
    const toSend = lowDec === 18 ? toSendNorm : toSendNorm / (10n ** BigInt(18 - lowDec));

    if (toSend > 0n) {
      const sendAmt = Number(ethers.formatUnits(toSend, lowDec)).toFixed(0);
      log('Skimming ' + sendAmt + ' ' + lowName + ' to owner ' + OWNER.slice(0, 10) + '...');
      const tokenC = new ethers.Contract(TOKENS[lowName].addr, ERC20_ABI, wallet);
      const tx = await tokenC.transfer(OWNER, toSend);
      await tx.wait();
      log('Sent | tx: ' + tx.hash);
    }
  }

  return { swapped: true, sold: highName, bought: lowName };
}

// ─── Commands ────────────────────────────────────────────────────────────────
async function cmdBalance(wallet, provider) {
  console.log('Tasern Balancer: ' + wallet.address);
  const pol = await provider.getBalance(wallet.address);
  console.log('POL: ' + ethers.formatEther(pol));
  console.log('');

  const bals = await getAllBalances(wallet.address, provider);
  for (const [name, info] of Object.entries(TOKENS)) {
    const bal = bals[name];
    if (bal > 0n) {
      console.log(name.padEnd(5) + Number(ethers.formatUnits(bal, info.decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 }));
    }
  }
}

async function cmdPrices(provider) {
  await initPricing(provider);
  const prices = await getAllPrices(provider);
  const sorted = Object.entries(prices).sort((a, b) => b[1] - a[1]);

  console.log('\nToken Prices (USDGLO ~ $1):');
  for (const [name, price] of sorted) {
    const flag = price === 0 ? ' (no price)' : '';
    console.log('  ' + name.padEnd(5) + '$' + price.toFixed(10) + flag);
  }

  const live = sorted.filter(([, p]) => p > 0);
  if (live.length >= 2) {
    const spread = ((live[0][1] - live[live.length - 1][1]) / live[live.length - 1][1] * 100);
    console.log('\nSpread: ' + spread.toFixed(2) + '% (dead zone: ' + DEAD_ZONE + '%)');
    console.log('Would sell: ' + live[0][0] + ' -> buy: ' + live[live.length - 1][0]);
  }
}

async function cmdOnce(wallet, provider) {
  await initPricing(provider);
  const result = await rebalanceCycle(wallet, provider);
  if (result.swapped) {
    log('Done: sold ' + result.sold + ' -> bought ' + result.bought);
  } else {
    log('Cycle skipped (no swap needed)');
  }
}

async function cmdRun(wallet, provider, sec) {
  const interval = Math.max(sec || LOOP_SEC, 30) * 1000;
  await initPricing(provider);

  log('Tasern Balancer running');
  log('Interval: ' + (interval / 1000) + 's | Dead zone: ' + DEAD_ZONE + '% | Swap: ' + SWAP_TOKENS.toLocaleString() + ' tokens');
  log('Cap: ' + TOTAL_CAP.toLocaleString() + ' total tokens');
  log('Owner: ' + (OWNER || 'NOT SET (excess will accumulate)'));
  log('Wallet: ' + wallet.address);
  console.log('');

  let cycles = 0, swaps = 0;
  while (true) {
    cycles++;
    try {
      const result = await rebalanceCycle(wallet, provider);
      if (result.swapped) swaps++;
      log('[' + cycles + '/' + swaps + ' swaps] Next in ' + (interval / 1000) + 's');
    } catch (e) {
      log('ERROR: ' + (e.shortMessage || e.message).slice(0, 120));
    }
    await new Promise(r => setTimeout(r, interval));
  }
}

async function cmdApprove(wallet) {
  const routers = [
    ['V2', ROUTER_ADDR],
    ['V3', V3_ROUTER],
  ];
  for (const [label, routerAddr] of routers) {
    log('Approving ' + label + ' Router ' + routerAddr.slice(0, 10) + '...');
    for (const [name, info] of Object.entries(TOKENS)) {
      const c = new ethers.Contract(info.addr, ERC20_ABI, wallet);
      const allow = await c.allowance(wallet.address, routerAddr);
      if (allow < ethers.MaxUint256 / 2n) {
        log('  ' + name + ' -> ' + label + '...');
        const tx = await c.approve(routerAddr, ethers.MaxUint256);
        await tx.wait();
      } else {
        log('  ' + name + ' already approved (' + label + ')');
      }
    }
  }
  log('All approvals done');
}

async function cmdSend(wallet, tokenName, to, amount) {
  const upper = tokenName.toUpperCase();
  const info = TOKENS[upper];
  if (!info) {
    console.error('Unknown token: ' + tokenName + '. Known: ' + Object.keys(TOKENS).join(', '));
    process.exit(1);
  }
  if (!ethers.isAddress(to)) {
    console.error('Invalid address: ' + to);
    process.exit(1);
  }
  const c = new ethers.Contract(info.addr, ERC20_ABI, wallet);
  const wei = ethers.parseUnits(amount, info.decimals);
  log('Sending ' + amount + ' ' + upper + ' to ' + to);
  const tx = await c.transfer(to, wei);
  await tx.wait();
  log('Sent | tx: ' + tx.hash);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const cmd = process.argv[2];

  if (!cmd || cmd === 'balance')  return cmdBalance(wallet, provider);
  if (cmd === 'prices')           return cmdPrices(provider);
  if (cmd === 'once')             return cmdOnce(wallet, provider);
  if (cmd === 'run')              return cmdRun(wallet, provider, parseInt(process.argv[3]));
  if (cmd === 'approve')          return cmdApprove(wallet);
  if (cmd === 'send')             return cmdSend(wallet, process.argv[3], process.argv[4], process.argv[5]);

  console.log([
    '', 'Tasern Balancer — D20 token rebalancer',
    '',
    'Commands:',
    '  balance              — wallet + token balances',
    '  prices               — all 8 token prices (USDGLO)',
    '  once                 — one rebalance cycle',
    '  run [seconds]        — continuous loop (default ' + LOOP_SEC + 's)',
    '  approve              — approve router for all tokens',
    '  send <TOKEN> <to> <n>— transfer tokens',
    '',
    'Tokens: ' + Object.keys(TOKENS).join(', '),
    '',
  ].join('\n'));
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
