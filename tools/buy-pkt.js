/**
 * buy-pkt.js — Buy PKT with DDD via USDGLO hop, 10 swaps of 10K DDD, 1 min apart
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const PKT = '0x8a088dceecbcf457762eb7c66f78fff27dc0c04a';
const USDGLO = '0x4f604735c1cf31399c6e711d5962b2b3e0225ad3';
const ROUTER = '0xedf6066a2b290C185783862C7F4776A2C8077AD1';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
];

const SWAP_AMOUNT = ethers.parseEther('10000');
const SWAPS = 10;
const DELAY_MS = 60000;

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const dddC = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const pktC = new ethers.Contract(PKT, ERC20_ABI, provider);
  const bal = await dddC.balanceOf(wallet.address);
  log('DDD balance: ' + Number(ethers.formatEther(bal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));

  const allowance = await dddC.allowance(wallet.address, ROUTER);
  if (allowance < SWAP_AMOUNT * BigInt(SWAPS)) {
    log('Approving router for DDD...');
    const tx = await dddC.approve(ROUTER, ethers.MaxUint256);
    await tx.wait();
    log('Approved');
  }

  const router = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
  const swapPath = [DDD, USDGLO, PKT];

  for (let i = 1; i <= SWAPS; i++) {
    try {
      const amounts = await router.getAmountsOut(SWAP_AMOUNT, swapPath);
      const expected = amounts[amounts.length - 1];
      log('Swap ' + i + '/' + SWAPS + ': 10,000 DDD → ~' + Number(ethers.formatEther(expected)).toFixed(0) + ' PKT');

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const tx = await router.swapExactTokensForTokens(SWAP_AMOUNT, 0n, swapPath, wallet.address, deadline);
      const receipt = await tx.wait();
      log('  Done. Gas: ' + receipt.gasUsed.toString() + ' | tx: ' + tx.hash);
    } catch (e) {
      log('  ERROR swap ' + i + ': ' + (e.shortMessage || e.message).slice(0, 80));
    }

    if (i < SWAPS) {
      log('  Waiting 1 minute...');
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  const dddFinal = await dddC.balanceOf(wallet.address);
  const pktFinal = await pktC.balanceOf(wallet.address);
  log('');
  log('=== Done ===');
  log('DDD remaining: ' + Number(ethers.formatEther(dddFinal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));
  log('PKT balance: ' + Number(ethers.formatEther(pktFinal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
