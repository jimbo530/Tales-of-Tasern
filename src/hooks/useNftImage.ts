"use client";

import { useState, useEffect } from "react";
import { resolveImage, toHttp } from "@/lib/resolveImage";

export function useNftImage(metadataUri?: string) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!metadataUri) { setImgFailed(true); return; }
    let cancelled = false;
    resolveImage(toHttp(metadataUri)).then((url) => {
      if (cancelled) return;
      if (url) setImageUrl(url);
      else setImgFailed(true);
    });
    return () => { cancelled = true; };
  }, [metadataUri]);

  return { imageUrl, imgLoaded, imgFailed, setImgLoaded, setImgFailed };
}
