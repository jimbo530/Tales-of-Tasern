import { NextResponse } from "next/server";
import { computeAllStats } from "../route";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — same as /api/stats

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

  const start = Date.now();
  try {
    console.log("[refresh] Computing all stats...");
    const result = await computeAllStats();
    console.log("[refresh] Computed", result.characters.length, "characters in", Date.now() - start, "ms");

    // Build upsert rows: one per NFT + one summary row
    const rows = result.characters.map(c => ({
      key: c.contractAddress.toLowerCase(),
      data: c,
      updated_at: new Date().toISOString(),
    }));

    rows.push({
      key: "__summary__",
      data: {
        sellerOwned: result.sellerOwned,
        assetTotals: result.assetTotals,
        tokenBreakdown: result.tokenBreakdown,
        prices: result.prices,
        updatedAt: result.updatedAt,
      } as any,
      updated_at: new Date().toISOString(),
    });

    // Batch upsert to Supabase (chunks of 200)
    let written = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabaseAdmin
        .from("nft_d20_stats")
        .upsert(chunk, { onConflict: "key" });
      if (error) {
        console.error("[refresh] Supabase upsert error at chunk", i, ":", error.message);
      } else {
        written += chunk.length;
      }
    }

    const elapsed = Date.now() - start;
    console.log("[refresh] Wrote", written, "/", rows.length, "rows to nft_d20_stats in", elapsed, "ms total");

    return NextResponse.json({
      ok: true,
      characters: result.characters.length,
      written,
      elapsed,
    });
  } catch (error) {
    console.error("[refresh] Failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
