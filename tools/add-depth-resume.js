/**
 * add-depth-resume.js — Resume from pair 16/28.
 * 13 remaining pairs, equal USD value both sides, full-range 1% V3.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const PK  = process.env.BALANCER_PRIVATE_KEY;
const p = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, p);

const NPM = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const FEE = 10000;

const TOKENS = {
  OGC: { addr: '0xccf37622e6b72352e7b410481dd4913563038b7c', dec: 18, usd: 0.00025822 },
  IGS: { addr: '0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce', dec: 8,  usd: 0.00018373 },
  BTN: { addr: '0xd7c584d40216576f1d8651eab8bef9de69497666', dec: 8,  usd: 0.00017708 },
  LGP: { addr: '0xddc330761761751e005333208889bfe36c6e6760', dec: 18, usd: 0.00017478 },
  DHG: { addr: '0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a', dec: 8,  usd: 0.00017671 },
  PKT: { addr: '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a', dec: 18, usd: 0.00025383 },
};

const REACTORS = {
  OGC: '0xDFF8c75f825e757923fF8f0dE83F814e02fDe5B4',
  IGS: '0x8e662E4b7f5e33DfC5F73E8A67b34E9e147825AA',
  BTN: '0x2b35C282c21cE95C6050254318044DF530079521',
  LGP: '0xAcbC4df046AC437c75EE020A534740dd5e425E41',
  DHG: '0x4ce08087953cb06C14A8Cd7cCEb130377762C170',
  PKT: '0x7c78B9368f27Da50ee48BaA213DF001b67A69559',
};

// Remaining 13 pairs (16-28 from original)
const PAIRS = [
  ['OGC', 'LGP'], ['OGC', 'DHG'], ['OGC', 'PKT'],
  ['IGS', 'BTN'], ['IGS', 'LGP'], ['IGS', 'DHG'], ['IGS', 'PKT'],
  ['BTN', 'LGP'], ['BTN', 'DHG'], ['BTN', 'PKT'],
  ['LGP', 'DHG'], ['LGP', 'PKT'],
  ['DHG', 'PKT'],
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

  // Get current reactor pool counts
  const poolCounts = {};
  for (const [name, addr] of Object.entries(REACTORS)) {
    const r = new ethers.Contract(addr, REACTOR_ABI, p);
    poolCounts[name] = Number(await r.poolCount());
  }
  log('Starting reactor pools: ' + JSON.stringify(poolCounts));
  log('Pairs remaining: ' + PAIRS.length);

  let minted = 0;
  const skipped = [];

  for (let idx = 0; idx < PAIRS.length; idx++) {
    const [nameA, nameB] = PAIRS[idx];
    const tA = TOKENS[nameA];
    const tB = TOKENS[nameB];

    log('\n[' + (idx + 1) + '/' + PAIRS.length + '] --- ' + nameA + '/' + nameB + ' ---');

    const cheapName = tA.usd <= tB.usd ? nameA : nameB;
    const expName = cheapName === nameA ? nameB : nameA;
    const cheapT = TOKENS[cheapName];
    const expT = TOKENS[expName];

    const cheapAmount = ethers.parseUnits('100000', cheapT.dec);
    const cheapUsd = 100000 * cheapT.usd;
    const expTokens = Math.floor(cheapUsd / expT.usd);
    const expAmount = ethers.parseUnits(expTokens.toString(), expT.dec);

    const cheapC = new ethers.Contract(cheapT.addr, ERC20_ABI, p);
    const expC = new ethers.Contract(expT.addr, ERC20_ABI, p);
    const cheapBal = await cheapC.balanceOf(wallet.address);
    const expBal = await expC.balanceOf(wallet.address);

    if (cheapBal < cheapAmount) {
      log('  SKIP -- low ' + cheapName);
      skipped.push(nameA + '/' + nameB);
      continue;
    }
    if (expBal < expAmount) {
      log('  SKIP -- low ' + expName);
      skipped.push(nameA + '/' + nameB);
      continue;
    }

    log('  ' + cheapName + ': 100,000 ($' + cheapUsd.toFixed(2) + ')');
    log('  ' + expName + ': ' + expTokens.toLocaleString() + ' ($' + (expTokens * expT.usd).toFixed(2) + ')');

    const reactorName = poolCounts[nameA] <= poolCounts[nameB] ? nameA : nameB;
    const reactorAddr = REACTORS[reactorName];
    log('  -> ' + reactorName + ' reactor (' + poolCounts[reactorName] + ' pools)');

    const aIsT0 = tA.addr.toLowerCase() < tB.addr.toLowerCase();
    const token0 = aIsT0 ? tA.addr : tB.addr;
    const token1 = aIsT0 ? tB.addr : tA.addr;
    const aAmount = nameA === cheapName ? cheapAmount : expAmount;
    const bAmount = nameB === cheapName ? cheapAmount : expAmount;
    const amount0 = aIsT0 ? aAmount : bAmount;
    const amount1 = aIsT0 ? bAmount : aAmount;

    const deadline = Math.floor(Date.now() / 1000) + 600;

    try {
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
      log('  MINTED #' + tokenId.toString() + ' | gas=' + receipt.gasUsed.toString());

      const tx2 = await npm.safeTransferFrom(wallet.address, reactorAddr, tokenId, await gas());
      await tx2.wait();
      log('  Transferred to ' + reactorName + ' reactor');

      const reactor = new ethers.Contract(reactorAddr, REACTOR_ABI, wallet);
      const tx3 = await reactor.addPool(tokenId, await gas());
      await tx3.wait();
      poolCounts[reactorName]++;
      log('  addPool done -- ' + reactorName + ': ' + poolCounts[reactorName] + ' pools');

      minted++;

      if (idx < PAIRS.length - 1) {
        log('  Next in 2 min...');
        await sleep(120000);
      }
    } catch (e) {
      log('  ERROR: ' + (e.shortMessage || e.message).slice(0, 200));
      skipped.push(nameA + '/' + nameB + ' (error)');
    }
  }

  log('\n\n========== DONE ==========');
  log('Minted: ' + minted + '/' + PAIRS.length);
  if (skipped.length) {
    log('Skipped:');
    skipped.forEach(s => log('  - ' + s));
  }
  log('\nFinal reactor pools:');
  for (const [name, addr] of Object.entries(REACTORS)) {
    const r = new ethers.Contract(addr, REACTOR_ABI, p);
    const c = await r.poolCount();
    log('  ' + name + ': ' + c.toString());
  }
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
