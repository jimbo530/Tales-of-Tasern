#!/usr/bin/env node
/**
 * Fetches fresh stats and ownership data, saves to local files.
 * Run once a day (or whenever you want fresh data):
 *   node scripts/refresh-stats.js
 *   node scripts/refresh-stats.js https://your-site.vercel.app/api/stats
 *
 * In dev mode, the app reads from these files — survives browser cache clears.
 */

const fs = require("fs");
const path = require("path");

const API_URL = process.argv[2] || "http://localhost:3000/api/stats";
const PUBLIC = path.join(__dirname, "..", "public");
const STATS_FILE = path.join(PUBLIC, "stats-cache.json");
const META_FILE = path.join(PUBLIC, "cache-meta.json");

async function main() {
  console.log("Fetching stats from", API_URL, "...");
  const start = Date.now();

  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();

    const chars = data.characters?.length ?? 0;
    const totals = data.assetTotals ?? {};

    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    fs.writeFileSync(META_FILE, JSON.stringify({
      timestamp: Date.now(),
      characters: chars,
      totalBacking: (totals.traditional + totals.game + totals.impact).toFixed(2),
    }, null, 2));

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done in ${elapsed}s — ${chars} characters, $${(totals.traditional + totals.game + totals.impact).toFixed(2)} total backing`);
    console.log(`Saved to ${STATS_FILE}`);
  } catch (e) {
    console.error("Failed:", e.message);
    process.exit(1);
  }
}

main();
