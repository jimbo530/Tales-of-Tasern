/**
 * deposit-to-30pct.js — Deposit game tokens to reach ~30% of supply in reactor pools.
 * Calculates how much each token needs, splits evenly across 7 reactor pools.
 * Run: node deposit-to-30pct.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const TOKENS = {
  '0x4bf82cf0d6b2afc87367052b793097153c859d38': { name: 'DDD', dec: 18, usd: 0.00046 },
  '0xd7c584d40216576f1d8651eab8bef9de69497666': { name: 'BTN', dec: 8,  usd: 0.00018 },
  '0xddc330761761751e005333208889bfe36c6e6760': { name: 'LGP', dec: 18, usd: 0.00017 },
  '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a': { name: 'PKT', dec: 18, usd: 0.00025 },
  '0x64f6f111e9fdb753877f17f399b759de97379170': { name: 'EGP', dec: 18, usd: 0.00018 },
  '0xccf37622e6b72352e7b410481dd4913563038b7c': { name: 'OGC', dec: 18, usd: 0.00026 },
  '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce': { name: 'IGS', dec: 8,  usd: 0.00018 },
  '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a': { name: 'DHG', dec: 8,  usd: 0.00018 },
};

const REACTORS = [
  { name: 'DDD', addr: '0x0d8389435abACD28410AD240613572E3d3573ADE', token: '0x4bf82cf0d6b2afc87367052b793097153c859d38' },
  { name: 'BTN', addr: '0x2b35C282c21cE95C6050254318044DF530079521', token: '0xd7c584d40216576f1d8651eab8bef9de69497666' },
  { name: 'LGP', addr: '0xAcbC4df046AC437c75EE020A534740dd5e425E41', token: '0xddc330761761751e005333208889bfe36c6e6760' },
  { name: 'PKT', addr: '0x7c78B9368f27Da50ee48BaA213DF001b67A69559', token: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a' },
  { name: 'EGP', addr: '0xA4756770d5366F11DE43BF620C21098A54de76dA', token: '0x64f6f111e9fdb753877f17f399b759de97379170' },
  { name: 'OGC', addr: '0xDFF8c75f825e757923fF8f0dE83F814e02fDe5B4', token: '0xccf37622e6b72352e7b410481dd4913563038b7c' },
  { name: 'IGS', addr: '0x8e662E4b7f5e33DfC5F73E8A67b34E9e147825AA', token: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce' },
  { name: 'DHG', addr: '0x4ce08087953cb06C14A8Cd7cCEb130377762C170', token: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a' },
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const REACTOR_ABI = [
  'function depositLiquidity(uint256 poolIndex, uint256 nationAmount, uint256 xAmount) external',
  'function poolCount() view returns (uint256)',
  'function pools(uint256) view returns (uint256 tokenId, address xToken, uint24 fee, bool nationIsToken0)',
];
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)'];
const ZERO = '0x0000000000000000000000000000000000000000';
const TARGET = 30_000_000;

function log(msg) { console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg); }

async function gas() {
  const fee = await p.getFeeData();
  return { maxFeePerGas: fee.maxFeePerGas * 2n, maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n };
}

async function main() {
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, p);
  log('Wallet: ' + wallet.address);

  // 1. Get current pool balances for each token
  log('\n=== CHECKING CURRENT POOL BALANCES ===');
  const inPools = {};
  const tokenPoolAddrs = {};

  for (const addr of Object.keys(TOKENS)) {
    tokenPoolAddrs[addr] = new Set();
  }

  for (const r of REACTORS) {
    const rc = new ethers.Contract(r.addr, REACTOR_ABI, p);
    const count = Number(await rc.poolCount());
    for (let i = 0; i < count; i++) {
      const pool = await rc.pools(i);
      const xToken = pool.xToken.toLowerCase();
      const nation = r.token.toLowerCase();
      const fee = Number(pool.fee);
      const poolAddr = await factory.getPool(nation, xToken, fee);
      if (poolAddr !== ZERO) {
        if (tokenPoolAddrs[nation]) tokenPoolAddrs[nation].add(poolAddr);
        if (tokenPoolAddrs[xToken]) tokenPoolAddrs[xToken].add(poolAddr);
      }
    }
  }

  for (const [addr, info] of Object.entries(TOKENS)) {
    const tokenC = new ethers.Contract(addr, ERC20_ABI, p);
    let total = 0n;
    for (const poolAddr of tokenPoolAddrs[addr]) {
      total += await tokenC.balanceOf(poolAddr);
    }
    const human = Number(ethers.formatUnits(total, info.dec));
    inPools[addr] = human;
    log(info.name + ' in pools: ' + Math.floor(human).toLocaleString());
  }

  // 2. Calculate per-pool deposit amounts (need / 7 pools per token)
  log('\n=== DEPOSIT PLAN ===');
  const perPool = {}; // tokenAddr -> amount per pool (in token units, integer)
  const totalNeeded = {}; // tokenAddr -> total needed

  for (const [addr, info] of Object.entries(TOKENS)) {
    const current = inPools[addr];
    const need = Math.max(0, TARGET - current);
    const perP = Math.floor(need / 7);
    perPool[addr] = perP;
    totalNeeded[addr] = Math.floor(need);
    log(info.name + ': need ' + Math.floor(need).toLocaleString() + ' more, ' + perP.toLocaleString() + ' per pool');
  }

  // 3. Map reactor pools
  log('\n=== MAPPING REACTOR POOLS ===');
  const reactorMap = [];
  for (const r of REACTORS) {
    const rc = new ethers.Contract(r.addr, REACTOR_ABI, p);
    const count = Number(await rc.poolCount());
    const seen = new Set();
    const pairs = [];
    for (let i = 0; i < count; i++) {
      const pool = await rc.pools(i);
      const xt = pool.xToken.toLowerCase();
      if (TOKENS[xt] && xt !== r.token.toLowerCase() && !seen.has(xt)) {
        pairs.push({ xTokenLower: xt, poolIndex: i });
        seen.add(xt);
      }
    }
    reactorMap.push({ name: r.name, addr: r.addr, tokenLower: r.token.toLowerCase(), pairs });
    log(r.name + ' reactor: ' + pairs.length + ' nation pools');
  }

  // 4. Approvals
  log('\n=== APPROVALS ===');
  for (const r of reactorMap) {
    for (const [addr] of Object.entries(TOKENS)) {
      if (perPool[addr] === 0) continue;
      const c = new ethers.Contract(addr, ERC20_ABI, wallet);
      const needed = ethers.parseUnits(totalNeeded[addr].toString(), TOKENS[addr].dec);
      const allow = await c.allowance(wallet.address, r.addr);
      if (allow < needed) {
        log('Approving ' + TOKENS[addr].name + ' for ' + r.name + ' reactor...');
        const tx = await c.approve(r.addr, ethers.MaxUint256, await gas());
        await tx.wait();
      }
    }
  }
  log('Approvals done');

  // 5. Deposits
  log('\n=== DEPOSITS ===');
  let totalDeps = 0;
  let errors = 0;

  for (const r of reactorMap) {
    const rc = new ethers.Contract(r.addr, REACTOR_ABI, wallet);
    const nationInfo = TOKENS[r.tokenLower];
    const nationPerPool = perPool[r.tokenLower];

    log('\n--- ' + r.name + ' REACTOR ---');

    for (const pair of r.pairs) {
      const xInfo = TOKENS[pair.xTokenLower];
      const xPerPool = perPool[pair.xTokenLower];

      // Both sides deposit their per-pool amount
      const nationAmt = ethers.parseUnits(nationPerPool.toString(), nationInfo.dec);
      const xAmt = ethers.parseUnits(xPerPool.toString(), xInfo.dec);

      if (nationAmt === 0n && xAmt === 0n) {
        log('  [' + pair.poolIndex + '] ' + nationInfo.name + '/' + xInfo.name + ': skip (both zero)');
        continue;
      }

      const nFmt = nationPerPool.toLocaleString();
      const xFmt = xPerPool.toLocaleString();

      try {
        log('  [' + pair.poolIndex + '] ' + nationInfo.name + '/' + xInfo.name + ': ' + nFmt + ' + ' + xFmt);
        const tx = await rc.depositLiquidity(pair.poolIndex, nationAmt, xAmt, await gas());
        await tx.wait();
        totalDeps++;
        log('  [' + pair.poolIndex + '] done');
      } catch (e) {
        errors++;
        log('  [' + pair.poolIndex + '] ERROR: ' + (e.shortMessage || e.message).slice(0, 150));
      }
    }
  }

  // 6. Summary
  log('\n========================================');
  log('Deposits: ' + totalDeps + '/56 | Errors: ' + errors);
  log('\nRemaining balances:');
  for (const [addr, info] of Object.entries(TOKENS)) {
    const c = new ethers.Contract(addr, ERC20_ABI, p);
    const bal = await c.balanceOf(wallet.address);
    const fmt = Number(ethers.formatUnits(bal, info.dec));
    log('  ' + info.name + ': ' + Math.floor(fmt).toLocaleString());
  }
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
