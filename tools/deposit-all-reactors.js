/**
 * deposit-all-reactors.js — Deposit 50% of each game token into all 8 reactors.
 * Each token goes into 14 pools (7 as nation, 7 as xToken), split evenly.
 * Run: node deposit-all-reactors.js
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

function log(msg) { console.log('[' + new Date().toISOString().slice(0, 19) + '] ' + msg); }

async function gas() {
  const fee = await p.getFeeData();
  return { maxFeePerGas: fee.maxFeePerGas * 2n, maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n };
}

async function main() {
  log('Wallet: ' + wallet.address);

  // 1. Get balances and compute per-pool allocation (50% / 14 pools)
  const budget = {}; // per-pool budget for each token
  log('\n=== TOKEN BUDGETS (50% / 14 pools each) ===');
  for (const [addr, info] of Object.entries(TOKENS)) {
    const c = new ethers.Contract(addr, ERC20_ABI, p);
    const bal = await c.balanceOf(wallet.address);
    const perPool = bal / 2n / 14n;
    budget[addr.toLowerCase()] = { bal, perPool, info };
    const fmtBal = Number(ethers.formatUnits(bal, info.dec));
    const fmtPer = Number(ethers.formatUnits(perPool, info.dec));
    log(info.name + ': ' + fmtBal.toLocaleString() + ' total, ' + fmtPer.toLocaleString() + ' per pool ($' + (fmtPer * info.usd).toFixed(2) + ')');
  }

  // 2. Scan all reactors to find first pool index for each nation xToken
  const reactorMap = []; // { name, addr, tokenLower, pairs: [{xTokenLower, poolIndex}] }
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
    log(r.name + ' reactor: ' + pairs.length + '/7 nation pools mapped');
  }

  // 3. Approve all tokens for all reactors
  log('\n=== APPROVALS ===');
  for (const r of reactorMap) {
    for (const [addr] of Object.entries(TOKENS)) {
      const c = new ethers.Contract(addr, ERC20_ABI, wallet);
      const allow = await c.allowance(wallet.address, r.addr);
      if (allow < budget[addr.toLowerCase()].bal) {
        log('Approving ' + TOKENS[addr].name + ' for ' + r.name + ' reactor...');
        const tx = await c.approve(r.addr, ethers.MaxUint256, await gas());
        await tx.wait();
      }
    }
  }
  log('Approvals done');

  // 4. Deposit into each reactor
  log('\n=== DEPOSITS ===');
  let totalDeps = 0;
  let errors = 0;

  for (const r of reactorMap) {
    const rc = new ethers.Contract(r.addr, REACTOR_ABI, wallet);
    const nationInfo = budget[r.tokenLower].info;
    const nationPerPool = budget[r.tokenLower].perPool;

    log('\n--- ' + r.name + ' REACTOR ---');

    for (const pair of r.pairs) {
      const xInfo = budget[pair.xTokenLower].info;
      const xPerPool = budget[pair.xTokenLower].perPool;

      // Use the smaller side by USD to keep balanced
      const nationUsd = Number(ethers.formatUnits(nationPerPool, nationInfo.dec)) * nationInfo.usd;
      const xUsd = Number(ethers.formatUnits(xPerPool, xInfo.dec)) * xInfo.usd;

      let nationAmt, xAmt;
      if (nationUsd <= xUsd) {
        // Nation is the limiting side, scale x down to match
        nationAmt = nationPerPool;
        const xNeeded = nationUsd / xInfo.usd;
        xAmt = ethers.parseUnits(Math.floor(xNeeded).toString(), xInfo.dec);
      } else {
        // X is the limiting side, scale nation down to match
        xAmt = xPerPool;
        const nationNeeded = xUsd / nationInfo.usd;
        nationAmt = ethers.parseUnits(Math.floor(nationNeeded).toString(), nationInfo.dec);
      }

      if (nationAmt === 0n || xAmt === 0n) {
        log('  [' + pair.poolIndex + '] ' + nationInfo.name + '/' + xInfo.name + ': skip (zero)');
        continue;
      }

      const nFmt = Number(ethers.formatUnits(nationAmt, nationInfo.dec)).toLocaleString();
      const xFmt = Number(ethers.formatUnits(xAmt, xInfo.dec)).toLocaleString();
      const usdFmt = Math.min(nationUsd, xUsd).toFixed(2);

      try {
        log('  [' + pair.poolIndex + '] ' + nationInfo.name + '/' + xInfo.name + ': ' + nFmt + ' + ' + xFmt + ' (~$' + usdFmt + ' each side)');
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

  // 5. Final summary
  log('\n========================================');
  log('Deposits: ' + totalDeps + '/56 | Errors: ' + errors);
  log('\nRemaining balances:');
  for (const [addr, info] of Object.entries(TOKENS)) {
    const c = new ethers.Contract(addr, ERC20_ABI, p);
    const bal = await c.balanceOf(wallet.address);
    const fmt = Number(ethers.formatUnits(bal, info.dec));
    log('  ' + info.name + ': ' + fmt.toLocaleString() + ' ($' + (fmt * info.usd).toFixed(2) + ')');
  }
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
