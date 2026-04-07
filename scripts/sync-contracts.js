#!/usr/bin/env node
/**
 * Sync NFTs and LP pairs from nft-lp-database JSON files → contracts.ts
 * Run: npm run sync-contracts
 *
 * Reads from ../nft-lp-database/nfts.json and lp-pairs.json (shared DB).
 * Rejects 0 results — if JSON is empty/missing, existing hardcoded data stays.
 */
const fs = require("fs");
const path = require("path");

const DB_DIR = path.resolve(__dirname, "..", "..", "nft-lp-database");
const CONTRACTS_PATH = path.resolve(__dirname, "..", "src", "lib", "contracts.ts");

function main() {
  if (!fs.existsSync(DB_DIR)) {
    console.error(`Shared DB not found at ${DB_DIR}`);
    console.error("Expected nft-lp-database/ next to this project.");
    process.exit(1);
  }

  const file = fs.readFileSync(CONTRACTS_PATH, "utf8");

  // ── Load NFTs ───────────────────────────────────────────────────────────────
  let nfts = null;
  const nftsPath = path.join(DB_DIR, "nfts.json");
  if (fs.existsSync(nftsPath)) {
    try {
      nfts = JSON.parse(fs.readFileSync(nftsPath, "utf8"));
      if (!Array.isArray(nfts) || nfts.length === 0) {
        console.warn("nfts.json is empty or invalid — rejecting, keeping existing fallback.");
        nfts = null;
      } else {
        console.log(`Loaded ${nfts.length} NFTs from nfts.json`);
      }
    } catch (e) {
      console.error("Failed to parse nfts.json:", e.message);
      nfts = null;
    }
  } else {
    console.warn("nfts.json not found — keeping existing fallback.");
  }

  // ── Load LP Pairs ──────────────────────────────────────────────────────────
  let lps = null;
  const lpsPath = path.join(DB_DIR, "lp-pairs.json");
  if (fs.existsSync(lpsPath)) {
    try {
      lps = JSON.parse(fs.readFileSync(lpsPath, "utf8"));
      const baseCount = (lps?.base || []).length;
      const polyCount = (lps?.polygon || []).length;
      if (baseCount === 0 && polyCount === 0) {
        console.warn("lp-pairs.json is empty — rejecting, keeping existing fallback.");
        lps = null;
      } else {
        console.log(`Loaded ${baseCount} base + ${polyCount} polygon LP pairs from lp-pairs.json`);
      }
    } catch (e) {
      console.error("Failed to parse lp-pairs.json:", e.message);
      lps = null;
    }
  } else {
    console.warn("lp-pairs.json not found — keeping existing fallback.");
  }

  let updated = file;

  // ── Replace GAME_NFTS ─────────────────────────────────────────────────────
  if (nfts) {
    const nftLines = nfts.map(r => {
      const name = (r.name || "").replace(/"/g, '\\"');
      const addr = r.contractAddress || r.contract_address;
      const chain = r.chain || "polygon";
      const pad = Math.max(1, 35 - name.length);
      return `  { name: "${name}",${" ".repeat(pad)}contractAddress: "${addr}", chain: "${chain}" },`;
    });
    const nftBlock = `// @sync-start:GAME_NFTS\nexport const GAME_NFTS: GameNft[] = [\n${nftLines.join("\n")}\n];\n// @sync-end:GAME_NFTS`;
    updated = updated.replace(
      /\/\/ @sync-start:GAME_NFTS[\s\S]*?\/\/ @sync-end:GAME_NFTS/,
      nftBlock
    );
    console.log(`Updated GAME_NFTS with ${nfts.length} entries`);
  }

  // ── Replace KNOWN_LP_PAIRS ────────────────────────────────────────────────
  if (lps) {
    const formatLp = (r) => {
      const addr = r.address || r.pair_address;
      const comment = r.comment || r.label || "";
      return `    "${addr}",${comment ? ` // ${comment}` : ""}`;
    };

    const lpBlock = [
      "// @sync-start:KNOWN_LP_PAIRS",
      "export const KNOWN_LP_PAIRS = {",
      "  base: [",
      ...(lps.base || []).map(formatLp),
      "  ] as `0x${string}`[],",
      "  polygon: [",
      ...(lps.polygon || []).map(formatLp),
      "  ] as `0x${string}`[],",
      "};",
      "// @sync-end:KNOWN_LP_PAIRS",
    ].join("\n");

    updated = updated.replace(
      /\/\/ @sync-start:KNOWN_LP_PAIRS[\s\S]*?\/\/ @sync-end:KNOWN_LP_PAIRS/,
      lpBlock
    );
    console.log(`Updated KNOWN_LP_PAIRS`);
  }

  if (updated !== file) {
    fs.writeFileSync(CONTRACTS_PATH, updated, "utf8");
    console.log("contracts.ts updated successfully");
  } else {
    console.log("No changes needed — contracts.ts already up to date");
  }
}

main();
