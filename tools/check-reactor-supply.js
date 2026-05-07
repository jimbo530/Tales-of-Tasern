/**
 * check-reactor-supply.js — Check how much of each game token's supply is locked in V3 pools
 * Queries actual pool contract balances (where V3 tokens really sit)
 * Run: node check-reactor-supply.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC;
const p = new ethers.JsonRpcProvider(RPC);

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

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const REACTOR_ABI = [
  'function poolCount() view returns (uint256)',
  'function pools(uint256) view returns (uint256 tokenId, address xToken, uint24 fee, bool nationIsToken0)',
];
const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FACTORY_ABI = ['function getPool(address,address,uint24) view returns (address)'];
const ZERO = '0x0000000000000000000000000000000000000000';

const TOTAL_SUPPLY = 100_000_000n;

async function main() {
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, p);

  // Collect all unique V3 pool addresses for each game token
  const tokenPools = {}; // tokenAddr -> Set of pool addresses
  for (const addr of Object.keys(TOKENS)) {
    tokenPools[addr] = new Set();
  }

  console.log('Scanning reactors for pool addresses...\n');

  for (const r of REACTORS) {
    const rc = new ethers.Contract(r.addr, REACTOR_ABI, p);
    const count = Number(await rc.poolCount());

    for (let i = 0; i < count; i++) {
      const pool = await rc.pools(i);
      const xToken = pool.xToken.toLowerCase();
      const nation = r.token.toLowerCase();
      const fee = Number(pool.fee);

      // Get the actual V3 pool contract address
      const poolAddr = await factory.getPool(nation, xToken, fee);
      if (poolAddr !== ZERO) {
        // This pool holds both the nation token and the xToken
        if (tokenPools[nation]) tokenPools[nation].add(poolAddr);
        if (tokenPools[xToken]) tokenPools[xToken].add(poolAddr);
      }
    }
  }

  // Now check each game token's balance across all its V3 pools
  console.log('=== GAME TOKEN SUPPLY IN REACTORS ===\n');
  console.log('Token  | In Pools         | % of 100M  | USD Value');
  console.log('-------|------------------|------------|----------');

  for (const [addr, info] of Object.entries(TOKENS)) {
    const tokenC = new ethers.Contract(addr, ERC20_ABI, p);
    const pools = tokenPools[addr];
    let totalInPools = 0n;

    for (const poolAddr of pools) {
      const bal = await tokenC.balanceOf(poolAddr);
      totalInPools += bal;
    }

    const totalSupplyWei = ethers.parseUnits(TOTAL_SUPPLY.toString(), info.dec);
    const pct = Number(totalInPools * 10000n / totalSupplyWei) / 100;
    const humanAmt = Number(ethers.formatUnits(totalInPools, info.dec));
    const usdVal = humanAmt * info.usd;

    const name = info.name.padEnd(6);
    const amt = humanAmt.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(16);
    const pctStr = (pct.toFixed(2) + '%').padStart(10);
    const usdStr = ('$' + usdVal.toFixed(2)).padStart(10);

    console.log(`${name} | ${amt} | ${pctStr} | ${usdStr}`);
  }

  console.log('\nPools per token:');
  for (const [addr, info] of Object.entries(TOKENS)) {
    console.log(`  ${info.name}: ${tokenPools[addr].size} unique V3 pools`);
  }
}

main().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
