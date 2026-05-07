#!/bin/bash
set -e

echo "=== Setting up Tales of Tasern D20 RPG ==="
cd /root/tot-game
tar xf /root/tot-game.tar
rm /root/tot-game.tar

# Set basePath for subpath hosting
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/tot",
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
EOF

echo "Installing D20 dependencies..."
npm install 2>&1
echo "Building D20..."
npm run build 2>&1
echo "D20 build complete!"

echo ""
echo "=== Setting up NFT Card Game ==="
cd /root/nft-game
tar xf /root/nft-game.tar
rm /root/nft-game.tar

# Set basePath for subpath hosting
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/cards",
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
EOF

echo "Installing card game dependencies..."
npm install 2>&1
echo "Building card game..."
npm run build 2>&1
echo "Card game build complete!"

echo ""
echo "=== Starting PM2 services ==="
cd /root/tot-game
PORT=3002 pm2 start "npm start" --name tot-game
cd /root/nft-game
PORT=3003 pm2 start "npm start" --name nft-game
pm2 save

echo ""
echo "=== Setting up cron jobs ==="
# D20 RPG crons
(crontab -l 2>/dev/null; echo "0 0 * * * curl -s https://tasern.quest/tot/api/update-chain-data > /dev/null") | sort -u | crontab -
(crontab -l 2>/dev/null; echo "0 1 * * 0 curl -s https://tasern.quest/tot/api/images > /dev/null") | sort -u | crontab -
(crontab -l 2>/dev/null; echo "0 12 * * * curl -s https://tasern.quest/tot/api/stats/refresh > /dev/null") | sort -u | crontab -
# Card game crons
(crontab -l 2>/dev/null; echo "0 0 * * * curl -s https://tasern.quest/cards/api/stats > /dev/null") | sort -u | crontab -
(crontab -l 2>/dev/null; echo "0 1 * * 0 curl -s https://tasern.quest/cards/api/images > /dev/null") | sort -u | crontab -

echo ""
echo "=== All done! ==="
pm2 list
crontab -l
