#!/usr/bin/env node
/**
 * Fetches fresh stats from the API and saves to a local file.
 * Run this once a day (or whenever you want fresh data):
 *   node scripts/refresh-stats.js
 *
 * In dev mode, the app will read from this file instead of hitting the API.
 */

const fs = require("fs");
const path = require("path");

const API_URL = process.argv[2] || "http://localhost:3000/api/stats";
const OUTPUT = path.join(__dirname, "..", "public", "stats-cache.json");

async function main() {
  console.log("Fetching stats from", API_URL, "...");
  const start = Date.now();

  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();

    const chars = data.characters?.length ?? 0;
    const totals = data.assetTotals ?? {};

    fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done in ${elapsed}s — ${chars} characters, $${(totals.traditional + totals.game + totals.impact).toFixed(2)} total backing`);
    console.log(`Saved to ${OUTPUT}`);
  } catch (e) {
    console.error("Failed:", e.message);
    process.exit(1);
  }
}

main();
