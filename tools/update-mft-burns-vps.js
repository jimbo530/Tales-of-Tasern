#!/usr/bin/env node
// VPS version — fetches burn balances + USD prices, writes to /var/www/tasern/mft/data.json
// Cron: runs daily at 6:00 UTC

const ethers = require('/root/baseling-api/node_modules/ethers');
const fs = require('fs');

const BURN = '0xfd780B0aE569e15e514B819ecFDF46f804953a4B';
const RPC  = 'https://mainnet.base.org';
const OUT  = '/var/www/tasern/mft/data.json';

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
    } catch (e) {
        console.warn('[mft-burns] MfT price failed:', e.message);
        return prices;
    }

    for (const [sym, cfg] of Object.entries(PRICE_POOLS)) {
        try {
            const pool = new ethers.Contract(cfg.pool, POOL_ABI, provider);
            const [sqrtPriceX96] = await pool.slot0();
            const rawPrice = sqrtPriceToPrice(sqrtPriceX96);
            if (cfg.mftIsToken0) {
                prices[sym] = (1 / rawPrice) * prices.MfT;
            } else {
                prices[sym] = rawPrice * prices.MfT;
            }
        } catch (e) {
            console.warn(`[mft-burns] ${sym} price failed:`, e.message);
        }
    }

    prices.AZUSD = 1;
    return prices;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });

    console.log('[mft-burns] Fetching burn balances...');

    const ethBal = await provider.getBalance(BURN);
    const mft = new ethers.Contract(TOKENS[0].addr, ABI, provider);
    const mftSupply = await mft.totalSupply();

    const results = [];
    for (const t of TOKENS) {
        try {
            const c = new ethers.Contract(t.addr, ABI, provider);
            const bal = await c.balanceOf(BURN);
            const formatted = parseFloat(ethers.formatUnits(bal, t.dec));
            results.push({ sym: t.sym, addr: t.addr, dec: t.dec, tag: t.tag, bal: bal.toString(), formatted });
        } catch (e) {
            console.warn(`  ${t.sym}: FAILED -`, e.message);
            results.push({ sym: t.sym, addr: t.addr, dec: t.dec, tag: t.tag, bal: '0', formatted: 0 });
        }
    }

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

    const data = {
        updated: new Date().toISOString(),
        burnAddress: BURN,
        ethBalance: ethers.formatEther(ethBal),
        mftTotalSupply: ethers.formatEther(mftSupply),
        totalBurnedUSD,
        tokens: results,
    };

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
    const withBal = results.filter(r => r.formatted > 0).length;
    console.log(`[mft-burns] Done. ${withBal} tokens, $${totalBurnedUSD.toFixed(2)} total burned. Saved to ${OUT}`);
}

main().catch(err => { console.error('[mft-burns] FATAL:', err); process.exit(1); });
