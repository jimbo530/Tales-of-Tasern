"use client";

import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import type { ReactNode } from "react";

/**
 * Wraps the OnchainKit MiniKitProvider for Base mini app integration.
 * Drop this inside an existing WagmiProvider / QueryClientProvider tree.
 *
 * TODO: Set NEXT_PUBLIC_ONCHAINKIT_API_KEY env var (CDP project key)
 *       for paymaster / sponsored txns.
 */
export function BaselingsMiniKitProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MiniKitProvider
      enabled
      notificationProxyUrl="/api/webhook"
    >
      {children}
    </MiniKitProvider>
  );
}
