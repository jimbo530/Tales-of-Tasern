#!/usr/bin/env node
/**
 * Baseling Keeper Bot — runs on VPS, handles automated contract maintenance
 *
 * Tasks:
 *   1. POOP Distribution — calls distributeBatch for all alive baselings every 4hr
 *   2. ETH Price Sync   — updates wethPerPoop so 1 POOP = $0.01 of ETH
 *   3. Seed Conversion   — converts pending egg seeds to LP via router
 *   4. wethPerLP Update  — keeps LP pair valuations current
 *   5. Death Check       — calls kill() on starved baselings (3 days unfed)
 *
 * Setup:
 *   npm install ethers
 *   Create .env with KEEPER_PRIVATE_KEY=0x... (fund this wallet with ETH for gas)
 *   node keeper.js
 *
 * The keeper wallet needs:
 *   - ETH on Base for gas (~0.001-0.01 ETH should last a long time)
 *   - No special contract permissions (distributeBatch + kill are public)
 *   - Owner privkey only needed for setWethPerPoop/setPairWethPerLP (admin tasks)
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// --- Config ---
const RPC_URL = 'https://mainnet.base.org';
const CHAIN_ID = 8453;

// Contract addresses
const POOP    = '0x126555aecBAC290b25644e4b7f29c016aE95f4dc';
const NFT     = '0xFCb825491490284189C75fD330Fd08Df5E9217b9';
const PANTRY  = '0xb62E32a93e2027356271C083F794cFFDb0ac4aa6';
const PP      = '0x493D3164F6d6187467B1FD3955bd1030763a7Fec';
const ROUTER  = '0x24213d631C9bf90EEaEAdde8bFdd4591eb95faD7';
const WETH    = '0x4200000000000000000000000000000000000006';
const MFT     = '0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3';

const LP_PAIRS = {
  tgn:     '0xbd0cc3b0aaf91b80c862dbcaf39faa4705ee2d7a',
  burgers: '0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288',
  azusd:   '0xecc664757da0c71ba32dfed527580a26783b6697'
};

// Chainlink ETH/USD on Base
const CHAINLINK_ETH_USD = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

// Task intervals (ms)
const POOP_INTERVAL     = 4 * 60 * 60 * 1000;  // 4 hours
const PRICE_INTERVAL    = 1 * 60 * 60 * 1000;   // 1 hour
const DEATH_INTERVAL    = 6 * 60 * 60 * 1000;    // 6 hours
const LP_PRICE_INTERVAL = 12 * 60 * 60 * 1000;   // 12 hours

// Batch size for distributeBatch
const BATCH_SIZE = 20;

// --- ABIs ---
const NFT_ABI = [
  'function totalMinted() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function baselings(uint256) view returns (uint8,uint8,bool,uint64,uint64,uint32,uint16)',
  'function distributeBatch(uint256[])',
  'function isDead(uint256) view returns (bool)',
  'function kill(uint256)',
  'function vaultSeeds(uint256) view returns (uint256)',
  'function wethPerPoop() view returns (uint256)',
  'function setWethPerPoop(uint256)',
  'function setPairWethPerLP(address,uint256)',
  'function pairs(address) view returns (bool,uint256)',
  'function totalPoopMinted() view returns (uint256)',
  'function totalPoopBurned() view returns (uint256)',
  'function totalLPLocked() view returns (uint256)',
  'function owner() view returns (address)',
];

const ROUTER_ABI = [
  'function convertSeed(uint256)',
  'function convertSeedBatch(uint256[])',
];

const CHAINLINK_ABI = [
  'function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)',
];

const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function totalSupply() view returns (uint256)',
  'function token0() view returns (address)',
];

const WETH_ABI = [
  'function balanceOf(address) view returns (uint256)',
];

// --- State ---
let provider, wallet, nft, router;
let isOwner = false;
const logFile = path.join(__dirname, 'keeper.log');

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch(e) {}
}

function loadEnv() {
  // Simple .env loader
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq > 0 && !line.startsWith('#')) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function init() {
  loadEnv();

  const privKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privKey) {
    log('KEEPER_PRIVATE_KEY not set in .env', 'ERROR');
    process.exit(1);
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(privKey, provider);
  nft = new ethers.Contract(NFT, NFT_ABI, wallet);
  router = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);

  const addr = wallet.address;
  const bal = await provider.getBalance(addr);
  log(`Keeper wallet: ${addr}`);
  log(`ETH balance: ${ethers.formatEther(bal)} ETH`);

  // Check if this wallet is the NFT contract owner (needed for price updates)
  try {
    const ownerAddr = await nft.owner();
    isOwner = ownerAddr.toLowerCase() === addr.toLowerCase();
    log(`Is contract owner: ${isOwner}`);
  } catch(e) {
    // owner() might not be in our ABI
    isOwner = false;
  }

  if (parseFloat(ethers.formatEther(bal)) < 0.0001) {
    log('WARNING: Low ETH balance! Keeper needs gas to send transactions.', 'WARN');
  }
}

// --- Task 1: POOP Distribution ---

async function distributePoop() {
  log('--- POOP Distribution ---');
  try {
    const totalMinted = Number(await nft.totalMinted());
    if (totalMinted === 0) { log('No baselings minted yet'); return; }

    // Find all alive baselings (state=1) that have vault LP
    const aliveIds = [];
    for (let id = 1; id <= totalMinted; id++) {
      try {
        const b = await nft.baselings(id);
        const state = Number(b[0]);
        // state 1=ALIVE, 2=FROZEN, 3=DEAD — all need distribution
        // (alive = mint to owner, frozen/dead = burn)
        if (state >= 1) aliveIds.push(id);
      } catch(e) {}
    }

    if (aliveIds.length === 0) { log('No baselings to distribute to'); return; }
    log(`Found ${aliveIds.length} baselings to distribute`);

    // Batch calls
    for (let i = 0; i < aliveIds.length; i += BATCH_SIZE) {
      const batch = aliveIds.slice(i, i + BATCH_SIZE);
      try {
        const tx = await nft.distributeBatch(batch);
        log(`distributeBatch tx: ${tx.hash} (IDs ${batch[0]}-${batch[batch.length-1]})`);
        await tx.wait();
        log(`Batch confirmed!`);
      } catch(e) {
        log(`distributeBatch failed: ${e.message}`, 'ERROR');
      }
    }

    // Log stats
    const minted = await nft.totalPoopMinted();
    const burned = await nft.totalPoopBurned();
    log(`Total POOP minted: ${ethers.formatEther(minted)}, burned: ${ethers.formatEther(burned)}`);
  } catch(e) {
    log(`distributePoop error: ${e.message}`, 'ERROR');
  }
}

// --- Task 2: ETH Price Sync (wethPerPoop) ---

async function syncETHPrice() {
  if (!isOwner) { log('Skipping ETH price sync (not owner)'); return; }
  log('--- ETH Price Sync ---');
  try {
    // Get ETH price from Chainlink
    const cl = new ethers.Contract(CHAINLINK_ETH_USD, CHAINLINK_ABI, provider);
    const data = await cl.latestRoundData();
    const ethPrice = Number(data[1]) / 1e8;
    log(`ETH price: $${ethPrice.toFixed(2)}`);

    // 1 POOP = $0.01 => wethPerPoop = 0.01 / ethPrice
    const wpp = 0.01 / ethPrice;
    const wppWei = ethers.parseEther(wpp.toFixed(18));

    // Check current value — only update if >2% drift
    const currentWpp = await nft.wethPerPoop();
    if (currentWpp > 0n) {
      const currentVal = parseFloat(ethers.formatEther(currentWpp));
      const drift = Math.abs(wpp - currentVal) / currentVal;
      if (drift < 0.02) {
        log(`Drift ${(drift*100).toFixed(1)}% < 2%, skipping update`);
        return;
      }
      log(`Drift ${(drift*100).toFixed(1)}%, updating wethPerPoop`);
    }

    const tx = await nft.setWethPerPoop(wppWei);
    log(`setWethPerPoop tx: ${tx.hash}`);
    await tx.wait();
    log(`wethPerPoop updated to ${wpp.toFixed(18)} (ETH=$${ethPrice.toFixed(2)})`);
  } catch(e) {
    log(`syncETHPrice error: ${e.message}`, 'ERROR');
  }
}

// --- Task 3: wethPerLP Update ---

async function updateWethPerLP() {
  if (!isOwner) { log('Skipping wethPerLP update (not owner)'); return; }
  log('--- wethPerLP Update ---');
  try {
    // Get MfT→WETH price from CoinGecko
    let mftToWeth = 0;
    try {
      const resp = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${MFT}&vs_currencies=eth`);
      const json = await resp.json();
      const key = MFT.toLowerCase();
      if (json[key]?.eth) mftToWeth = json[key].eth;
    } catch(e) {}

    if (mftToWeth === 0) {
      log('Could not get MfT price, skipping', 'WARN');
      return;
    }
    log(`MfT price: ${mftToWeth} WETH`);

    const keys = ['tgn', 'burgers', 'azusd'];
    for (let i = 0; i < keys.length; i++) {
      const pa = LP_PAIRS[keys[i]];
      try {
        const pair = new ethers.Contract(pa, PAIR_ABI, provider);
        const [r0, r1] = await pair.getReserves();
        const supply = await pair.totalSupply();
        const t0 = await pair.token0();

        const mftReserve = t0.toLowerCase() === MFT.toLowerCase() ? r0 : r1;
        const mftPerLP = Number(ethers.formatEther(mftReserve)) * 2 / Number(ethers.formatEther(supply));
        const wethPerLP = mftPerLP * mftToWeth;

        // Check drift
        const pairInfo = await nft.pairs(pa);
        const currentVal = parseFloat(ethers.formatEther(pairInfo[1]));
        if (currentVal > 0) {
          const drift = Math.abs(wethPerLP - currentVal) / currentVal;
          if (drift < 0.05) {
            log(`${keys[i]}: drift ${(drift*100).toFixed(1)}% < 5%, skipping`);
            continue;
          }
        }

        const tx = await nft.setPairWethPerLP(pa, ethers.parseEther(wethPerLP.toFixed(18)));
        log(`${keys[i]} wethPerLP tx: ${tx.hash}`);
        await tx.wait();
        log(`${keys[i]} wethPerLP = ${wethPerLP.toFixed(18)}`);
      } catch(e) {
        log(`${keys[i]} wethPerLP error: ${e.message}`, 'ERROR');
      }
    }
  } catch(e) {
    log(`updateWethPerLP error: ${e.message}`, 'ERROR');
  }
}

// --- Task 4: Death Check ---

async function checkDeaths() {
  log('--- Death Check ---');
  try {
    const totalMinted = Number(await nft.totalMinted());
    if (totalMinted === 0) return;

    let killed = 0;
    for (let id = 1; id <= totalMinted; id++) {
      try {
        const dead = await nft.isDead(id);
        if (dead) {
          log(`Baseling ${id} has starved — calling kill()`);
          const tx = await nft.kill(id);
          await tx.wait();
          log(`Baseling ${id} killed`);
          killed++;
        }
      } catch(e) {}
    }
    log(`Death check complete: ${killed} killed`);
  } catch(e) {
    log(`checkDeaths error: ${e.message}`, 'ERROR');
  }
}

// --- Task Scheduler ---

function scheduleTask(name, fn, interval) {
  async function run() {
    try {
      await fn();
    } catch(e) {
      log(`Task ${name} crashed: ${e.message}`, 'ERROR');
    }
    setTimeout(run, interval);
  }
  // Stagger start times so tasks don't all fire at once
  const delay = Math.floor(Math.random() * 30000);
  setTimeout(run, delay);
  log(`Scheduled: ${name} every ${(interval/60000).toFixed(0)}min (first run in ${(delay/1000).toFixed(0)}s)`);
}

// --- Status Report ---

async function statusReport() {
  log('=== KEEPER STATUS ===');
  const bal = await provider.getBalance(wallet.address);
  log(`Keeper ETH: ${ethers.formatEther(bal)}`);
  try {
    const minted = await nft.totalMinted();
    const poopMinted = await nft.totalPoopMinted();
    const poopBurned = await nft.totalPoopBurned();
    const lpLocked = await nft.totalLPLocked();
    log(`Baselings: ${minted}, LP Locked: ${ethers.formatEther(lpLocked)}`);
    log(`POOP Minted: ${ethers.formatEther(poopMinted)}, Burned: ${ethers.formatEther(poopBurned)}`);
  } catch(e) {}
  log('====================');
}

// --- Main ---

async function main() {
  log('Baseling Keeper starting...');
  await init();
  await statusReport();

  // Schedule all tasks
  scheduleTask('POOP Distribution', distributePoop, POOP_INTERVAL);
  scheduleTask('ETH Price Sync', syncETHPrice, PRICE_INTERVAL);
  scheduleTask('Death Check', checkDeaths, DEATH_INTERVAL);
  scheduleTask('wethPerLP Update', updateWethPerLP, LP_PRICE_INTERVAL);

  // Status report every 6 hours
  scheduleTask('Status Report', statusReport, 6 * 60 * 60 * 1000);

  log('All tasks scheduled. Keeper is running.');
}

main().catch(e => {
  log(`Fatal: ${e.message}`, 'ERROR');
  process.exit(1);
});
