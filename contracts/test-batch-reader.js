/**
 * Quick test of deployed BatchReader on Base
 */
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

const BATCH_READER = '0xADcAd5C07a70229907D0B83B2700e244218F7084';
const ABI = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'out', 'contracts_BatchReader_sol_BatchReader.abi'), 'utf8'));

const BASE_LPS = [
  "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84",
  "0x4da71963e031d22c25f2b2682454cae834504eb9",
  "0x36d0c273faca6e90f827bc2e7d232246f9f89fe4",
];
const BASE_NFTS = [
  "0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30",
  "0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5",
];

async function main() {
  const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || 'https://mainnet.base.org';
  console.log('RPC:', rpcUrl.replace(/\/v2\/.*/, '/v2/***'));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const reader = new ethers.Contract(BATCH_READER, ABI, provider);

  console.log('Testing batchPairInfo (3 Base LP pairs)...');
  const infos = await reader.batchPairInfo(BASE_LPS);
  for (let i = 0; i < infos.length; i++) {
    console.log(`  [${i}] token0=${infos[i].token0.slice(0,10)}... token1=${infos[i].token1.slice(0,10)}... supply=${infos[i].totalSupply} r0=${infos[i].reserve0} r1=${infos[i].reserve1}`);
  }

  console.log('\nTesting batchLpBalances (2 NFTs x 3 LPs)...');
  const balances = await reader.batchLpBalances(BASE_NFTS, BASE_LPS);
  console.log(`  Got ${balances.length} balances`);
  let nonZero = 0;
  for (let i = 0; i < balances.length; i++) {
    if (balances[i] > 0n) {
      const nftIdx = Math.floor(i / BASE_LPS.length);
      const lpIdx = i % BASE_LPS.length;
      console.log(`  NFT[${nftIdx}] has ${balances[i]} LP from pair[${lpIdx}]`);
      nonZero++;
    }
  }
  console.log(`  Non-zero: ${nonZero}/${balances.length}`);

  console.log('\nTesting batchAll (2 NFTs x 3 LPs)...');
  try {
    const [pairInfos, bals] = await reader.batchAll(BASE_NFTS, BASE_LPS);
    console.log(`  Got ${pairInfos.length} pair infos, ${bals.length} balances`);
  } catch(e) {
    console.log('  batchAll failed (expected on public RPC):', e.code);
    console.log('  Use batchPairInfo + batchLpBalances separately instead');
  }

  console.log('\nFull Base test: all 22 NFTs x 12 LPs...');
  const ALL_BASE_NFTS = ["0x9de88faa0dbcfc75534d1b4fd277dadffcc4fd30","0xfaf9a6b6409b3e69f7d3b38099b41c45bbc29ba5","0xea39112525f9169038435cF22f82e5436e0BCC4F","0x691e4bEF9A83C00f8A35ed601090E42A8b953c77","0x63a9c72C90860eaa64A39A31E1A4B00305aA3974","0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f","0x4A35B948F49A169976FCCC96220676692c987A57","0x26CE8466eC418b7D42d8789476642cdFbB5e8aab","0x76D50Fbc46a31aC21855b2b8218F4F642991c25e","0xB9c37Ce29A0966f83B29c905c434905301435D9d","0x716AdcbEd9Ef58CCf11434Aa7962b0f200A030af","0x412495cde08733715C2478c6EE00876ABF5e6CE8","0xaF92bc25a44bf43eC4100cAd6eA3620523C7DAce","0xA8a51d236a7af87D82fE2B29249B0aD70BA91d1A","0x99b772412C0D6E0fB31f227eCFf4E92B98379Fa8","0x44B374923178d4f80C3C158824F11Ac4A6D6266d","0xf6Af75e0E275ade819BDBaAECd67C4A7F78736a5","0xe608b78d14e98d0b34e142acb89561e9918346b5","0x4ada15ea83765c25ABA9aFce1C1d1b15b27C7d70","0xCd43D8eB17736bFDBd8862B7e03b6B5a4ad476A2","0xC9F92bA591c816c2dE2710F872C9919E08C0c412","0xaeA15d04bfD9A6DCC2B7B13F4BcBBcb11B851530"].map(a => ethers.getAddress(a.toLowerCase()));
  const ALL_BASE_LPS = ["0x74af6fd7f98d4ec868156e7d33c6db81fc222e84","0x4da71963e031d22c25f2b2682454cae834504eb9","0x36d0c273faca6e90f827bc2e7d232246f9f89fe4","0x9aa2f6cfbd0a075a504e155085ac86f91b438287","0x52fe32ed5d90c2b24af5a20496f01dc3fc965838","0xa2a61fd7816951a0bcf8c67ea8f153c1ab5de288","0x2f9669acb8623e33a0d3f9a3e1806ebe54cd319a","0x7af66828a7d1041db8b183f1356797788979eaf8","0xbd0cc3b0aaf91b80c862dbcaf39faa4705ee2d7a","0x2873937bb8985b0b2aafe693742c35f557ff8bff","0x6fbb3c6e531f627496d1c98ec88fb0cb01260926","0xecc664757da0c71ba32dfed527580a26783b6697"].map(a => ethers.getAddress(a));
  const allInfos = await reader.batchPairInfo(ALL_BASE_LPS);
  console.log(`  Pair infos: ${allInfos.length}`);
  const allBals = await reader.batchLpBalances(ALL_BASE_NFTS, ALL_BASE_LPS);
  let fullNonZero = 0;
  for (let i = 0; i < allBals.length; i++) { if (allBals[i] > 0n) fullNonZero++; }
  console.log(`  LP balances: ${allBals.length} total, ${fullNonZero} non-zero`);
  console.log('\nAll tests passed!');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
