/**
 * buy-egp.js — Buy EGP with DDD in 10 swaps, 1 min apart
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ethers = require('ethers');

const RPC = process.env.POLYGON_RPC || 'https://polygon-rpc.com';
const PK = process.env.BALANCER_PRIVATE_KEY;

const DDD = '0x4bf82cf0d6b2afc87367052b793097153c859d38';
const EGP = '0x64f6f111e9fdb753877f17f399b759de97379170';
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
const DELAY_MS = 60000; // 1 minute

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const dddC = new ethers.Contract(DDD, ERC20_ABI, wallet);
  const egpC = new ethers.Contract(EGP, ERC20_ABI, provider);
  const bal = await dddC.balanceOf(wallet.address);
  log('DDD balance: ' + Number(ethers.formatEther(bal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));

  // Approve router
  const allowance = await dddC.allowance(wallet.address, ROUTER);
  if (allowance < SWAP_AMOUNT * BigInt(SWAPS)) {
    log('Approving router for DDD...');
    const tx = await dddC.approve(ROUTER, ethers.MaxUint256);
    await tx.wait();
    log('Approved');
  }

  const router = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
  const swapPath = [DDD, EGP];

  for (let i = 1; i <= SWAPS; i++) {
    try {
      const amounts = await router.getAmountsOut(SWAP_AMOUNT, swapPath);
      const expectedEGP = amounts[1];
      log('Swap ' + i + '/' + SWAPS + ': 10,000 DDD → ~' + Number(ethers.formatEther(expectedEGP)).toFixed(0) + ' EGP');

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
  const egpFinal = await egpC.balanceOf(wallet.address);
  log('');
  log('=== Done ===');
  log('DDD remaining: ' + Number(ethers.formatEther(dddFinal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));
  log('EGP balance: ' + Number(ethers.formatEther(egpFinal)).toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message);
  process.exit(1);
});
