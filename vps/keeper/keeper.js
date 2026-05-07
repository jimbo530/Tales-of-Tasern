require("dotenv").config();
const { ethers } = require("ethers");

// --- Config ---
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const POLL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 50; // max tokens per convertSeedBatch tx

const BASELING_NFT = "0xFCb825491490284189C75fD330Fd08Df5E9217b9";
const BASELING_ROUTER = "0x24213d631C9bf90EEaEAdde8bFdd4591eb95faD7";

// --- ABIs (only what we need) ---
const NFT_ABI = [
  "function totalMinted() view returns (uint256)",
  "function vaultSeeds(uint256 tokenId) view returns (uint256)",
];

const ROUTER_ABI = [
  "function convertSeedBatch(uint256[] tokenIds)",
  "function convertSeed(uint256 tokenId)",
];

// --- Boot checks ---
if (!PRIVATE_KEY) {
  console.error("[FATAL] KEEPER_PRIVATE_KEY not set in environment. Exiting.");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL, 8453);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const nft = new ethers.Contract(BASELING_NFT, NFT_ABI, provider);
const router = new ethers.Contract(BASELING_ROUTER, ROUTER_ABI, wallet);

function ts() {
  return new Date().toISOString();
}

async function checkAndConvert() {
  try {
    const totalMinted = Number(await nft.totalMinted());
    console.log(`[${ts()}] totalMinted: ${totalMinted}`);

    if (totalMinted === 0) {
      console.log(`[${ts()}] No tokens minted yet. Skipping.`);
      return;
    }

    // Scan all tokens for unconverted seeds
    const unconverted = [];
    const checks = [];

    for (let id = 1; id <= totalMinted; id++) {
      checks.push(
        nft.vaultSeeds(id).then((seeds) => {
          if (seeds > 0n) {
            unconverted.push(id);
          }
        }).catch((err) => {
          console.error(`[${ts()}] Error checking vaultSeeds(${id}): ${err.message}`);
        })
      );

      // Throttle: resolve in chunks of 20 to avoid hammering the RPC
      if (checks.length >= 20) {
        await Promise.all(checks);
        checks.length = 0;
      }
    }

    // Flush remaining
    if (checks.length > 0) {
      await Promise.all(checks);
    }

    if (unconverted.length === 0) {
      console.log(`[${ts()}] All seeds converted. Nothing to do.`);
      return;
    }

    // Sort so logs are readable
    unconverted.sort((a, b) => a - b);
    console.log(`[${ts()}] Found ${unconverted.length} unconverted seed(s): [${unconverted.join(", ")}]`);

    // Process in batches
    for (let i = 0; i < unconverted.length; i += BATCH_SIZE) {
      const batch = unconverted.slice(i, i + BATCH_SIZE);

      if (batch.length === 1) {
        // Single token -- use convertSeed to save gas
        console.log(`[${ts()}] Converting seed for token ${batch[0]}...`);
        const tx = await router.convertSeed(batch[0]);
        console.log(`[${ts()}] tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[${ts()}] Confirmed in block ${receipt.blockNumber} | gas used: ${receipt.gasUsed.toString()}`);
      } else {
        console.log(`[${ts()}] Converting batch of ${batch.length} seeds: [${batch.join(", ")}]...`);
        const tx = await router.convertSeedBatch(batch);
        console.log(`[${ts()}] tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`[${ts()}] Confirmed in block ${receipt.blockNumber} | gas used: ${receipt.gasUsed.toString()}`);
      }
    }

    console.log(`[${ts()}] Cycle complete.`);
  } catch (err) {
    console.error(`[${ts()}] Cycle error: ${err.message}`);
  }
}

// --- Main ---
async function main() {
  console.log(`[${ts()}] Baseling Keeper starting`);
  console.log(`[${ts()}] Wallet: ${wallet.address}`);
  console.log(`[${ts()}] RPC: ${RPC_URL}`);
  console.log(`[${ts()}] Poll interval: ${POLL_MS / 1000}s`);
  console.log(`[${ts()}] NFT contract: ${BASELING_NFT}`);
  console.log(`[${ts()}] Router contract: ${BASELING_ROUTER}`);

  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`[${ts()}] Wallet balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.warn(`[${ts()}] WARNING: Wallet has zero ETH. Transactions will fail until funded.`);
  }

  // Run immediately on start, then every 5 minutes
  await checkAndConvert();
  setInterval(checkAndConvert, POLL_MS);
}

main().catch((err) => {
  console.error(`[${ts()}] Fatal: ${err.message}`);
  process.exit(1);
});
