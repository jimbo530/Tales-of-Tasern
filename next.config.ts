import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the CDP SDK (native/server deps) out of the bundler; run it as a Node external in
  // server route handlers only. This also guarantees CDP creds never leak into a client bundle.
  serverExternalPackages: ["@coinbase/cdp-sdk"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "*.ipfs.nftstorage.link" },
      { protocol: "https", hostname: "*.ipfs.w3s.link" },
      { protocol: "https", hostname: "*.mypinata.cloud" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "*.arweave.net" },
      { protocol: "https", hostname: "opensea.io" },
    ],
  },
};

export default nextConfig;
