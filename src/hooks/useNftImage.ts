"use client";

import { useState, useEffect } from "react";
import { resolveImage, toHttp } from "@/lib/resolveImage";
import { getCachedImage, downloadAndCache } from "@/lib/imageCache";

export function useNftImage(metadataUri?: string, contractAddress?: string) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const cacheKey = contractAddress?.toLowerCase() ?? metadataUri?.toLowerCase() ?? "";

  useEffect(() => {
    if (!metadataUri) { setImgFailed(true); return; }
    let cancelled = false;

    async function load() {
      // Check local cache first
      if (cacheKey) {
        const cached = await getCachedImage(cacheKey);
        if (cached && !cancelled) {
          setImageUrl(cached);
          return;
        }
      }

      // Resolve from network
      const url = await resolveImage(toHttp(metadataUri!));
      if (cancelled) return;
      if (!url) { setImgFailed(true); return; }
      setImageUrl(url);

      // Cache it in background for next time
      if (cacheKey) {
        downloadAndCache(cacheKey, url);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [metadataUri, cacheKey]);

  return { imageUrl, imgLoaded, imgFailed, setImgLoaded, setImgFailed };
}
