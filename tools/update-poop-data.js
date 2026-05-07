#!/usr/bin/env node
// Fetches POOP on-chain data and saves to public/poop/data.json
// Run: node tools/update-poop-data.js

const ethers = require('/root/baseling-api/node_modules/ethers');
const fs = require('fs');

const POOP = '0x126555aecBAC290b25644e4b7f29c016aE95f4dc';
const DEAD = '0x000000000000000000000000000000000000dEaD';
const FAC  = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const RPC  = 'https://mainnet.base.org';
const OUT  = '/var/www/tasern/poop/data.json';

const TOKENS = [
    {sym:'WETH',   addr:'0x4200000000000000000000000000000000000006', type:'bc', pool:'0x97ca8db8076b3c8a5f5c5c58c67988ea3723dbe7'},
    {sym:'USDC',   addr:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', type:'bc', pool:'0xd92A713A1BA56bA2b0c90bFaac8Cae918Fa9e281'},
    {sym:'cbBTC',  addr:ethers.getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'), type:'bc', pool:'0xCEC89d3406e07D9d5fc0617D059095291988cD60'},
    {sym:'BURGERS',addr:'0x06A05043eb2C1691b19c2C13219dB9212269dDc5', type:'cm'},
    {sym:'TGN',    addr:'0xD75dfa972C6136f1c594Fec1945302f885E1ab29', type:'cm'},
    {sym:'BRETT',  addr:'0x532f27101965dd16442E59d40670FaF5eBB142E4', type:'cm'},
    {sym:'AZUSD',  addr:'0x3595ca37596D5895B70EFAB592ac315D5B9809B2', type:'cm'},
    {sym:'EGP',    addr:'0xc1ba76771bbf0dd841347630e57c793f9d5accee', type:'cm'},
    {sym:'BUSTER', addr:'0xBFC5cD421bBC91A2Ca976C4AB1754748634b7D41', type:'cm'},
    {sym:'CHAR',   addr:'0x20b048fa035d5763685d695e66adf62c5d9f5055', type:'cm'},
    {sym:'FUN',    addr:'0x16EE7ecAc70d1028E7712751E2Ee6BA808a7dd92', type:'cm'},
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });
    const poop = new ethers.Contract(POOP, [
        'function totalMinted() view returns (uint256)',
        'function totalBurned() view returns (uint256)',
        'function totalSupply() view returns (uint256)',
        'function balanceOf(address) view returns (uint256)',
    ], provider);
    const factory = new ethers.Contract(FAC, [
        'function getPool(address,address,uint24) view returns (address)',
    ], provider);

    console.log('[poop] Fetching on-chain data...');

    const totalMinted = await poop.totalMinted();
    const totalBurned = await poop.totalBurned();
    const totalSupply = await poop.totalSupply();
    const deadBal = await poop.balanceOf(DEAD);

    const removed = totalBurned + deadBal;
    const circ = totalSupply - deadBal;

    // Resolve pools
    const pools = [];
    for (const t of TOKENS) {
        let poolAddr = t.pool;
        if (!poolAddr) {
            try {
                poolAddr = await factory.getPool(POOP, t.addr, 10000);
                if (poolAddr === '0x0000000000000000000000000000000000000000') continue;
            } catch { continue; }
        }
        pools.push({ sym: t.sym, type: t.type, pool: poolAddr });
    }

    const data = {
        updated: new Date().toISOString(),
        totalSupply: ethers.formatEther(totalSupply),
        totalMinted: ethers.formatEther(totalMinted),
        totalBurned: ethers.formatEther(totalBurned),
        deadBalance: ethers.formatEther(deadBal),
        removed: ethers.formatEther(removed),
        circulating: ethers.formatEther(circ),
        pools,
    };

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
    console.log(`[poop] Done. Supply: ${data.totalSupply}, Burned: ${data.totalBurned}, Pools: ${pools.length}`);
}

main().catch(err => { console.error('[poop] FATAL:', err); process.exit(1); });
