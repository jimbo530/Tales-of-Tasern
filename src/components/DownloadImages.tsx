"use client";

import { useState, useEffect } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { downloadAndCache, getCacheCount, clearImageCache } from "@/lib/imageCache";
import { resolveImage, toHttp } from "@/lib/resolveImage";

export function DownloadImages({ characters }: { characters: NftCharacter[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getCacheCount().then(setCachedCount);
  }, []);

  async function downloadAll() {
    setDownloading(true);
    setStatus("Resolving images...");
    let done = 0;
    let failed = 0;
    for (const c of characters) {
      if (!c.metadataUri) { failed++; continue; }
      try {
        const url = await resolveImage(toHttp(c.metadataUri));
        if (url) {
          const ok = await downloadAndCache(c.contractAddress, url);
          if (ok) done++;
          else failed++;
        } else { failed++; }
      } catch { failed++; }
      setStatus(`Downloaded ${done}/${characters.length}${failed > 0 ? ` (${failed} failed)` : ""}`);
    }
    setStatus(`Done! ${done} images cached locally.`);
    setCachedCount(await getCacheCount());
    setDownloading(false);
  }

  async function clearAll() {
    await clearImageCache();
    setCachedCount(0);
    setStatus("Cache cleared.");
  }

  return (
    <div className="w-full max-w-lg flex items-center justify-center gap-3 flex-wrap px-4 py-2 rounded-lg"
      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <span className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
        {cachedCount}/{characters.length} images cached
      </span>
      <button onClick={downloadAll} disabled={downloading}
        className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(96,165,250,0.2)', color: 'rgba(96,165,250,0.9)', border: '1px solid rgba(96,165,250,0.4)', opacity: downloading ? 0.5 : 1 }}>
        {downloading ? "Downloading..." : "Download All Images"}
      </button>
      {cachedCount > 0 && (
        <button onClick={clearAll}
          className="px-2 py-1 rounded text-xs"
          style={{ color: 'rgba(220,38,38,0.5)', border: '1px solid rgba(220,38,38,0.2)' }}>
          Clear
        </button>
      )}
      {status && <span className="text-xs w-full text-center" style={{ color: 'rgba(74,222,128,0.7)' }}>{status}</span>}
    </div>
  );
}
