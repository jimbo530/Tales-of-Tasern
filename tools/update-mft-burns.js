#!/usr/bin/env node
// Fetches all token balances at the MfT burn address, computes USD values, saves to public/mft/data.json
// Includes: network tokens, launched tokens (from Supabase), CHAR leaderboard (per-source breakdown)
// Run: node tools/update-mft-burns.js

const localEnv = require('path').join(__dirname, '..', '..', 'Baselings', 'api', '.env');
const fs = require('fs');
require('dotenv').config({ path: fs.existsSync(localEnv) ? localEnv : require('path').join(__dirname, '.env') });
const { ethers } = require('ethers');
const path = require('path');

const BURN = '0xfd780B0aE569e15e514B819ecFDF46f804953a4B';
const RPC  = 'https://mainnet.base.org';
const OUT  = path.join(__dirname, '..', 'public', 'mft', 'data.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const CHAR_ADDR = '0x20b048fA035D5763685D695e66aDF62c5D9F5055';
const CHAR_REACTOR = '0xc2eBe90fB9bC7897f06DC00666951Fa9a49A397A';
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const BURN_PADDED = ethers.zeroPadValue(BURN, 32).toLowerCase();
const CHAR_SCAN_START = 45000000;
const CHUNK = 9999;

// Network tokens (static)
const TOKENS = [
    {sym:'MfT',     addr:'0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3', dec:18, tag:'core'},
    {sym:'EARTH',   addr:'0x5CfBecf0209F7ada1EdF1fC0D2Fce3a809C0aE08', dec:18, tag:'core'},
    {sym:'POOP',    addr:'0x126555aecBAC290b25644e4b7f29c016aE95f4dc', dec:18, tag:'core'},
    {sym:'WETH',    addr:'0x4200000000000000000000000000000000000006', dec:18, tag:'bc'},
    {sym:'USDC',    addr:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dec:6,  tag:'bc'},
    {sym:'cbBTC',   addr:ethers.getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'), dec:8, tag:'bc'},
    {sym:'CHAR',    addr:'0x20b048fa035d5763685d695e66adf62c5d9f5055', dec:18, tag:'impact'},
    {sym:'BURGERS', addr:'0x06A05043eb2C1691b19c2C13219dB9212269dDc5', dec:18, tag:'impact'},
    {sym:'TGN',     addr:'0xD75dfa972C6136f1c594Fec1945302f885E1ab29', dec:18, tag:'cm'},
    {sym:'AZUSD',   addr:'0x3595ca37596D5895B70EFAB592ac315D5B9809B2', dec:18, tag:'impact'},
    {sym:'EGP',     addr:'0xc1ba76771bbf0dd841347630e57c793f9d5accee', dec:18, tag:'cm'},
    {sym:'BRETT',   addr:'0x532f27101965dd16442E59d40670FaF5eBB142E4', dec:18, tag:'cm'},
    {sym:'BUSTER',  addr:'0xBFC5cD421bBC91A2Ca976C4AB1754748634b7D41', dec:18, tag:'cm'},
    {sym:'FUN',     addr:'0x16EE7ecAc70d1028E7712751E2Ee6BA808a7dd92', dec:18, tag:'cm'},
];

const AZUSD_MFT_POOL = '0x53f6bF5e58304eF210bfBD9d6389880Ecc522A62';
const PRICE_POOLS = {
    BURGERS: { pool: '0xC0ac5a160Ecfb2623C83560038F129A6ca27B5B6', mftIsToken0: false },
    EGP:     { pool: '0xaf7BeEb970F4C8864C5b6a5900eb586e18835A7C', mftIsToken0: true },
    CHAR:    { pool: '0x25ADdFab07b3A4aEDf38117a471c4E5f84366Fe7', mftIsToken0: false },
    POOP:    { pool: '0xFdBBf9Ffe236C319633e72f575A3C34E13F7d113', mftIsToken0: false },
};

const ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
];
const POOL_ABI = [
    'function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)',
];

function sqrtPriceToPrice(sqrtPriceX96) {
    return Number(sqrtPriceX96) ** 2 / (2 ** 192);
}

async function fetchPrices(provider) {
    const prices = {};
    try {
        const pool = new ethers.Contract(AZUSD_MFT_POOL, POOL_ABI, provider);
        const [sqrtPriceX96] = await pool.slot0();
        prices.MfT = 1 / sqrtPriceToPrice(sqrtPriceX96);
        console.log(`  MfT price: $${prices.MfT.toExponential(4)}`);
    } catch (e) {
        console.warn('  MfT price: FAILED -', e.message);
        return prices;
    }
    for (const [sym, cfg] of Object.entries(PRICE_POOLS)) {
        try {
            const pool = new ethers.Contract(cfg.pool, POOL_ABI, provider);
            const [sqrtPriceX96] = await pool.slot0();
            const rawPrice = sqrtPriceToPrice(sqrtPriceX96);
            prices[sym] = cfg.mftIsToken0
                ? (1 / rawPrice) * prices.MfT
                : rawPrice * prices.MfT;
            console.log(`  ${sym} price: $${prices[sym].toExponential(4)}`);
        } catch (e) {
            console.warn(`  ${sym} price: FAILED -`, e.message);
        }
    }
    prices.AZUSD = 1;
    return prices;
}

// Fetch launched tokens from Supabase
async function fetchLaunchedTokens() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('  No Supabase creds — skipping launched tokens');
        return [];
    }
    const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    // Try with char_reactor_address, fallback without
    let res = await fetch(
        SUPABASE_URL + '/rest/v1/launched_tokens?select=symbol,name,token_address,reactor_address,char_reactor_address&chain_id=eq.8453',
        { headers }
    );
    if (!res.ok) {
        res = await fetch(
            SUPABASE_URL + '/rest/v1/launched_tokens?select=symbol,name,token_address,reactor_address&chain_id=eq.8453',
            { headers }
        );
    }
    if (!res.ok) {
        console.log('  Supabase fetch failed: ' + res.status);
        return [];
    }
    return res.json();
}

// Scan CHAR Transfer events to burn address, group by sender
async function scanCharSources(provider, currentBlock, nameMap) {
    console.log('\nScanning CHAR burns to burn address...');
    const sources = {};
    let scanned = 0;

    for (let from = CHAR_SCAN_START; from <= currentBlock; from += CHUNK + 1) {
        const to = Math.min(from + CHUNK, currentBlock);
        try {
            const logs = await provider.getLogs({
                address: ethers.getAddress(CHAR_ADDR),
                topics: [TRANSFER_TOPIC, null, BURN_PADDED],
                fromBlock: from, toBlock: to,
            });
            for (const log of logs) {
                const sender = ethers.getAddress('0x' + log.topics[1].slice(26));
                const amount = BigInt(log.data);
                sources[sender] = (sources[sender] || 0n) + amount;
            }
            scanned++;
        } catch (e) {
            console.log('  CHAR scan error ' + from + '-' + to + ': ' + (e.message || '').slice(0, 60));
        }
    }

    console.log(`  Scanned ${scanned} chunks, found ${Object.keys(sources).length} source(s)`);

    return Object.entries(sources)
        .map(([addr, amount]) => ({
            addr,
            name: nameMap[addr.toLowerCase()] || 'unknown (' + addr.slice(0, 8) + '...)',
            burned: ethers.formatEther(amount),
            burnedRaw: amount.toString(),
        }))
        .sort((a, b) => {
            const av = BigInt(a.burnedRaw), bv = BigInt(b.burnedRaw);
            return bv > av ? 1 : bv < av ? -1 : 0;
        });
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });
    const currentBlock = await provider.getBlockNumber();

    console.log('Fetching burn balances from Base...');
    console.log(`  Block: ${currentBlock}`);

    const ethBal = await provider.getBalance(BURN);
    const mft = new ethers.Contract(TOKENS[0].addr, ABI, provider);
    const mftSupply = await mft.totalSupply();
    console.log(`  MfT supply: ${ethers.formatEther(mftSupply)}`);

    // --- Network tokens ---
    console.log('\nNetwork tokens:');
    const results = [];
    for (const t of TOKENS) {
        try {
            const c = new ethers.Contract(t.addr, ABI, provider);
            const bal = await c.balanceOf(BURN);
            const formatted = parseFloat(ethers.formatUnits(bal, t.dec));
            console.log(`  ${t.sym}: ${formatted}`);
            results.push({ sym: t.sym, addr: t.addr, dec: t.dec, tag: t.tag, bal: bal.toString(), formatted });
        } catch (e) {
            console.warn(`  ${t.sym}: FAILED -`, e.message);
            results.push({ sym: t.sym, addr: t.addr, dec: t.dec, tag: t.tag, bal: '0', formatted: 0 });
        }
    }

    // --- Launched tokens ---
    console.log('\nFetching launched tokens...');
    const launches = await fetchLaunchedTokens();
    console.log(`  Found ${launches.length} launched token(s)`);

    const launchedResults = [];
    const charReactorNames = { [CHAR_REACTOR.toLowerCase()]: 'CHAR reactor (core)' };

    for (const l of launches) {
        if (!l.token_address) continue;
        try {
            const c = new ethers.Contract(l.token_address, ABI, provider);
            const bal = await c.balanceOf(BURN);
            let dec = 18;
            try { dec = Number(await c.decimals()); } catch {}
            const formatted = parseFloat(ethers.formatUnits(bal, dec));
            console.log(`  ${l.symbol}: ${formatted}`);
            launchedResults.push({
                sym: l.symbol, addr: l.token_address, dec, tag: 'launched',
                bal: bal.toString(), formatted, usdValue: 0,
            });
        } catch (e) {
            console.warn(`  ${l.symbol}: FAILED -`, e.message);
        }
        // Map CHAR reactors for leaderboard
        if (l.char_reactor_address) {
            charReactorNames[l.char_reactor_address.toLowerCase()] = l.symbol + ' CHAR reactor';
        }
    }

    // --- Prices + USD values ---
    console.log('\nFetching prices...');
    const prices = await fetchPrices(provider);

    let totalBurnedUSD = 0;
    for (const t of results) {
        if (t.formatted > 0 && prices[t.sym]) {
            t.usdValue = t.formatted * prices[t.sym];
            totalBurnedUSD += t.usdValue;
        } else {
            t.usdValue = 0;
        }
    }
    console.log(`\nTotal burned USD (network): $${totalBurnedUSD.toFixed(2)}`);

    // --- CHAR leaderboard ---
    const charToken = results.find(t => t.sym === 'CHAR');
    const charSources = await scanCharSources(provider, currentBlock, charReactorNames);

    for (const s of charSources) {
        console.log(`  ${s.name}: ${Number(s.burned).toFixed(6)} CHAR`);
    }

    // --- Build output ---
    const allTokens = [...results, ...launchedResults];

    const data = {
        updated: new Date().toISOString(),
        block: currentBlock,
        burnAddress: BURN,
        ethBalance: ethers.formatEther(ethBal),
        mftTotalSupply: ethers.formatEther(mftSupply),
        totalBurnedUSD,
        tokens: allTokens,
        charLeaderboard: {
            total: charToken ? charToken.formatted : 0,
            totalRaw: charToken ? charToken.bal : '0',
            totalUsd: charToken ? charToken.usdValue : 0,
            sources: charSources,
        },
    };

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
    console.log(`\nSaved to ${OUT}`);
    console.log(`Network tokens with balance: ${results.filter(r => r.formatted > 0).length}`);
    console.log(`Launched tokens with balance: ${launchedResults.filter(r => r.formatted > 0).length}`);
    console.log(`CHAR sources: ${charSources.length}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
