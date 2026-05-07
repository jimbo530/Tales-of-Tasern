"use client";

import { useEffect, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";

/**
 * /game route -- loads baseling-proto.html inside an iframe
 * and signals the Farcaster mini app host that the frame is ready.
 */
export default function GamePage() {
  const onIframeLoad = useCallback(() => {
    // Tell the Farcaster host the mini app is ready to be shown
    sdk.actions.ready().catch(() => {
      // Not running inside a mini app host -- ignore
    });
  }, []);

  useEffect(() => {
    // Also fire ready on mount in case the iframe loaded before
    // the React component mounted (cached / fast load)
    sdk.actions.ready().catch(() => {});
  }, []);

  return (
    <iframe
      src="/baseling-proto.html"
      onLoad={onIframeLoad}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
        overflow: "hidden",
        background: "#0a0608",
      }}
      allow="clipboard-write"
      title="Baselings"
    />
  );
}
