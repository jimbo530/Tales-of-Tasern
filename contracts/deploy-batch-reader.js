/**
 * Deploy BatchReader on Base and/or Polygon
 * Usage: node contracts/deploy-batch-reader.js [base|polygon|both]
 */
// Load env + ethers from Baselings (where both are installed)
// Load keys from both Baselings api/.env and ToT .env.local
for (const p of [
  require('path').join(__dirname, '..', '..', 'Baselings', 'api', '.env'),
  require('path').join(__dirname, '..', '.env.local'),
]) {
  try {
    for (const line of require('fs').readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}
const { ethers } = require(require('path').join(__dirname, '..', '..', 'Baselings', 'node_modules', 'ethers'));
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('No AGENT_PRIVATE_KEY in Baselings/api/.env'); process.exit(1); }

const BYTECODE = '0x' + fs.readFileSync(path.join(__dirname, 'out', 'contracts_BatchReader_sol_BatchReader.bin'), 'utf8').trim();
const ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'contracts_BatchReader_sol_BatchReader.abi'), 'utf8'));

const CHAINS = {
  base: { rpc: 'https://mainnet.base.org', name: 'Base', chainId: 8453 },
  polygon: { rpc: process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_URL || 'https://polygon-rpc.com', name: 'Polygon', chainId: 137 },
};

async function deploy(chainKey) {
  const chain = CHAINS[chainKey];
  console.log(`\nDeploying BatchReader on ${chain.name}...`);

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Wallet:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), chainKey === 'polygon' ? 'POL' : 'ETH');

  if (balance === 0n) {
    console.log('No balance — skipping ' + chain.name);
    return null;
  }

  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);
  console.log('Sending deploy tx...');
  const contract = await factory.deploy();
  console.log('Tx hash:', contract.deploymentTransaction().hash);
  console.log('Waiting for confirmation...');
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`BatchReader deployed on ${chain.name}: ${addr}`);
  return addr;
}

async function main() {
  const target = process.argv[2] || 'both';
  const results = {};

  if (target === 'base' || target === 'both') {
    results.base = await deploy('base');
  }
  if (target === 'polygon' || target === 'both') {
    results.polygon = await deploy('polygon');
  }

  console.log('\n=== RESULTS ===');
  for (const [chain, addr] of Object.entries(results)) {
    if (addr) console.log(`${chain}: ${addr}`);
    else console.log(`${chain}: SKIPPED`);
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
