import { NextResponse } from "next/server";
import { computeAllStats } from "../route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

const BATCH_COUNT = 4; // Split NFTs into 4 batches across the day

export async function GET(request: Request) {
  // Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  // Skip auth if CRON_SECRET not configured (local dev)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Auto-detect batch from UTC hour (0-3 for 4 batches across 24h)
  const url = new URL(request.url);
  const forceFull = url.searchParams.get("full") === "1";
  const batchIndex = Math.floor(new Date().getUTCHours() / (24 / BATCH_COUNT));
  const batch = forceFull ? undefined : { index: batchIndex, total: BATCH_COUNT };

  const start = Date.now();
  try {
    console.log("[refresh]", forceFull ? "Full run" : `Batch ${batchIndex}/${BATCH_COUNT}`, "starting...");
    const result = await computeAllStats(batch);
    console.log("[refresh] Computed", result.characters.length, "characters in", Date.now() - start, "ms");

    // Build chain-data rows for nft_backing
    const backingRows = result.characters.map(c => ({
      key: c.contractAddress.toLowerCase(),
      data: {
        name: c.name,
        contractAddress: c.contractAddress,
        chain: c.chain,
        usdBacking: c.usdBacking,
        tokenAmounts: c.tokenAmounts,
      },
      updated_at: new Date().toISOString(),
    }));

    // Summary always gets fresh prices (pair data computed every run)
    backingRows.push({
      key: "__summary__",
      data: {
        assetTotals: result.assetTotals,
        tokenBreakdown: result.tokenBreakdown,
        prices: result.prices,
        tokenUsdPrices: result.tokenUsdPrices,
        updatedAt: result.updatedAt,
      } as any,
      updated_at: new Date().toISOString(),
    });

    // Batch upsert to nft_backing
    let backingWritten = 0;
    for (let i = 0; i < backingRows.length; i += 200) {
      const chunk = backingRows.slice(i, i + 200);
      const { error } = await supabaseAdmin
        .from("nft_backing")
        .upsert(chunk, { onConflict: "key" });
      if (error) {
        console.error("[refresh] nft_backing upsert error at chunk", i, ":", error.message);
      } else {
        backingWritten += chunk.length;
      }
    }

    const elapsed = Date.now() - start;
    console.log("[refresh] Wrote", backingWritten, "/", backingRows.length, "to nft_backing in", elapsed, "ms total");

    return NextResponse.json({
      ok: true,
      batch: forceFull ? "full" : `${batchIndex}/${BATCH_COUNT}`,
      characters: result.characters.length,
      backingWritten,
      elapsed,
    });
  } catch (error) {
    console.error("[refresh] Failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
