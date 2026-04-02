#!/usr/bin/env node
/**
 * Fetches fresh stats, retries until no $0 tokens, saves locally.
 * Run once a day or set up as a scheduled task:
 *   node scripts/refresh-stats.js
 *   node scripts/refresh-stats.js https://your-site.vercel.app/api/stats
 *
 * Windows Task Scheduler (midnight UTC):
 *   schtasks /create /tn "ToT Stats Refresh" /tr "node C:\Users\bigji\Documents\nft-game\scripts\refresh-stats.js" /sc daily /st 00:00
 *
 * Or use Vercel cron (already set up in vercel.json hitting /api/stats at midnight UTC)
 */

const fs = require("fs");
const path = require("path");

const API_URL = process.argv[2] || "http://localhost:3000/api/stats";
const PUBLIC = path.join(__dirname, "..", "public");
const STATS_FILE = path.join(PUBLIC, "stats-cache.json");
const META_FILE = path.join(PUBLIC, "cache-meta.json");
const MAX_RETRIES = 5;
const RETRY_DELAY = 30000; // 30 seconds

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchStats() {
  const res = await fetch(`${API_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

async function main() {
  console.log("Fetching stats from", API_URL, "...\n");
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchStats();
      const chars = data.characters ?? [];
      const zeros = chars.filter(c => c.usdBacking === 0);
      const totals = data.assetTotals ?? {};
      const totalBacking = (totals.traditional + totals.game + totals.impact).toFixed(2);

      console.log(`Attempt ${attempt}/${MAX_RETRIES}: ${chars.length} characters, $${totalBacking} backing, ${zeros.length} with $0`);

      if (zeros.length > 0) {
        console.log("$0 NFTs:");
        zeros.forEach(c => console.log(`  ${c.name} (${c.chain}) ${c.contractAddress.slice(0, 10)}`));
      }

      // Merge image data into stats
      try {
        const imgUrl = API_URL.replace("/api/stats", "/api/images");
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          let merged = 0;
          for (const c of data.characters) {
            const img = imgData[c.contractAddress.toLowerCase()];
            if (img) {
              c.metadataUri = img.metadataUri ?? c.metadataUri;
              c.imageUrl = img.imageUrl ?? c.imageUrl;
              if (img.chain) c.chain = img.chain;
              merged++;
            }
          }
          console.log(`Merged images for ${merged} characters`);
        }
      } catch (e) { console.log("Image merge skipped:", e.message); }

      // Zero-protection: don't overwrite good data with worse data
      let shouldSave = true;
      if (fs.existsSync(STATS_FILE)) {
        try {
          const existing = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
          const oldChars = existing.characters ?? [];
          const oldBacking = oldChars.reduce((s, c) => s + (c.usdBacking ?? 0), 0);
          const newBacking = chars.reduce((s, c) => s + (c.usdBacking ?? 0), 0);
          // If new data lost >50% of backing, keep old file
          if (newBacking < oldBacking * 0.5 && oldBacking > 10) {
            console.log(`  WARNING: New backing $${newBacking.toFixed(2)} is <50% of old $${oldBacking.toFixed(2)} — keeping existing file`);
            shouldSave = false;
          }
          // Per-NFT: carry forward stats for NFTs that went to zero
          if (shouldSave && oldChars.length > 0) {
            const oldMap = new Map(oldChars.map(c => [c.contractAddress?.toLowerCase(), c]));
            for (const c of chars) {
              const old = oldMap.get(c.contractAddress?.toLowerCase());
              if (!old) continue;
              if (old.usdBacking > 0 && c.usdBacking === 0) {
                c.stats = old.stats;
                c.usdBacking = old.usdBacking;
                c.tokenAmounts = old.tokenAmounts;
                c.subtypes = old.subtypes;
              }
            }
          }
        } catch {}
      }

      if (shouldSave) {
        fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
        fs.writeFileSync(META_FILE, JSON.stringify({
          timestamp: Date.now(),
          characters: chars.length,
          totalBacking,
          zerosRemaining: zeros.length,
        }, null, 2));
      }

      if (zeros.length === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`\nAll tokens have values! Done in ${elapsed}s`);
        console.log(`Saved to ${STATS_FILE}`);
        return;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`\nRetrying in ${RETRY_DELAY / 1000}s...\n`);
        await sleep(RETRY_DELAY);
      }
    } catch (e) {
      console.error(`Attempt ${attempt} failed:`, e.message);
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY / 1000}s...\n`);
        await sleep(RETRY_DELAY);
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s — some tokens may still be $0 (RPC issues)`);
  console.log(`Saved best result to ${STATS_FILE}`);
}

main();
