#!/usr/bin/env node
// Fetches EARTH on-chain data and saves to public/earth/data.json
// Run: node tools/update-earth-data.js

const ethers = require('/root/baseling-api/node_modules/ethers');
const fs = require('fs');

const EARTH   = '0x5CfBecf0209F7ada1EdF1fC0D2Fce3a809C0aE08';
const REACTOR = '0x424D8BC900C6cc22E791C01d7E92CEd149a232f7';
const FAC     = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const RPC     = 'https://mainnet.base.org';
const OUT     = '/var/www/tasern/earth/data.json';

const TOKENS = [
    {sym:'WETH',    addr:'0x4200000000000000000000000000000000000006', type:'bc'},
    {sym:'USDC',    addr:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', type:'bc'},
    {sym:'cbBTC',   addr:ethers.getAddress('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'), type:'bc', pool:'0xD2907a46294d0Ad9a463591ee1bEa1a46b6ACb36'},
    {sym:'MfT',     addr:'0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3', type:'cm', pool:'0xfDa4F5aeC252F2853e3779e4c20a2c2ddC369bcE'},
    {sym:'CHAR',    addr:'0x20b048fa035d5763685d695e66adf62c5d9f5055', type:'cm', pool:'0xA2f2B3C8e751A99D5DE1538792A16bB1b73A776b'},
    {sym:'POOP',    addr:'0x126555aecBAC290b25644e4b7f29c016aE95f4dc', type:'cm', pool:'0x07a5F1FA87C5b39EAC2842DeC84e0ede9A95b70f'},
    {sym:'AZUSD',   addr:'0x3595ca37596D5895B70EFAB592ac315D5B9809B2', type:'cm', pool:'0xf9Ed4BCA0daeaFCce25333E4dE2e3eE9448B70F3'},
    {sym:'TGN',     addr:'0xD75dfa972C6136f1c594Fec1945302f885E1ab29', type:'cm', pool:'0xc45CbA9622763fDE55Eb708B53b70C67c3093e00'},
    {sym:'BURGERS', addr:'0x06A05043eb2C1691b19c2C13219dB9212269dDc5', type:'cm', pool:'0x2Dbd80F6435B0317D907578a838B3868316206aB'},
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });

    const earth = new ethers.Contract(EARTH, [
        'function totalSupply() view returns (uint256)',
        'function rebaseIndex() view returns (uint256)',
    ], provider);

    const reactor = new ethers.Contract(REACTOR, [
        'function poolCount() view returns (uint256)',
        'function lastExecute() view returns (uint256)',
    ], provider);

    const factory = new ethers.Contract(FAC, [
        'function getPool(address,address,uint24) view returns (address)',
    ], provider);

    console.log('[earth] Fetching on-chain data...');

    const supply = await earth.totalSupply();
    const index = await earth.rebaseIndex();
    const poolCount = await reactor.poolCount();
    const lastExec = await reactor.lastExecute();

    // Resolve pools
    const pools = [];
    for (const t of TOKENS) {
        let poolAddr = t.pool;
        if (!poolAddr) {
            try {
                poolAddr = await factory.getPool(EARTH, t.addr, 10000);
                if (poolAddr === '0x0000000000000000000000000000000000000000') continue;
            } catch { continue; }
        }
        pools.push({ sym: t.sym, type: t.type, pool: poolAddr });
    }

    const data = {
        updated: new Date().toISOString(),
        totalSupply: ethers.formatEther(supply),
        rebaseIndex: ethers.formatEther(index),
        poolCount: poolCount.toString(),
        lastExecute: lastExec.toString(),
        pools,
    };

    fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
    console.log(`[earth] Done. Supply: ${data.totalSupply}, Index: ${data.rebaseIndex}, Pools: ${pools.length}`);
}

main().catch(err => { console.error('[earth] FATAL:', err); process.exit(1); });
