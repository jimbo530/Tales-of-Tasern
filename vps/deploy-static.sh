#!/bin/bash
# Deploy static pages to VPS
# Run from Tales-of-Tasern root: bash vps/deploy-static.sh
set -e

VPS="vps"  # SSH alias
REMOTE="/var/www/tasern"
LOCAL="public"

echo "=== Deploying static pages to $VPS:$REMOTE ==="

# Landing page -> index.html (front door)
echo "Deploying landing page as index.html..."
scp "$LOCAL/landing.html" "$VPS:$REMOTE/index.html"

# llms.txt (agent discovery)
echo "Deploying llms.txt..."
scp "$LOCAL/llms.txt" "$VPS:$REMOTE/llms.txt"

# PWA manifest + service worker + icons
echo "Deploying PWA files..."
scp "$LOCAL/manifest.json" "$VPS:$REMOTE/manifest.json"
scp "$LOCAL/sw.js" "$VPS:$REMOTE/sw.js"
scp "$LOCAL/icon-192.svg" "$VPS:$REMOTE/icon-192.svg"
scp "$LOCAL/icon-512.svg" "$VPS:$REMOTE/icon-512.svg"

# Burn stats page
echo "Deploying /mft/..."
ssh "$VPS" "mkdir -p $REMOTE/mft"
scp "$LOCAL/mft/index.html" "$LOCAL/mft/data.json" "$LOCAL/mft/bg.jpg" "$VPS:$REMOTE/mft/"

# Token index
echo "Deploying /tokens/..."
ssh "$VPS" "mkdir -p $REMOTE/tokens"
scp -r "$LOCAL/tokens/"* "$VPS:$REMOTE/tokens/"

# Impact tracker
echo "Deploying /impact/..."
ssh "$VPS" "mkdir -p $REMOTE/impact"
scp -r "$LOCAL/impact/"* "$VPS:$REMOTE/impact/"

# EARTH data
echo "Deploying /earth/..."
ssh "$VPS" "mkdir -p $REMOTE/earth"
scp -r "$LOCAL/earth/"* "$VPS:$REMOTE/earth/"

# POOP data
echo "Deploying /poop/..."
ssh "$VPS" "mkdir -p $REMOTE/poop"
scp -r "$LOCAL/poop/"* "$VPS:$REMOTE/poop/"

# Legal docs (if they exist locally)
for doc in terms.html privacy.html risk.html; do
    if [ -f "$LOCAL/$doc" ]; then
        echo "Deploying $doc..."
        scp "$LOCAL/$doc" "$VPS:$REMOTE/$doc"
    fi
done

# .well-known (agent discovery: ai-plugin.json, mcp.json, farcaster.json)
echo "Deploying .well-known/..."
ssh "$VPS" "mkdir -p $REMOTE/.well-known"
scp -r "$LOCAL/.well-known/"* "$VPS:$REMOTE/.well-known/"

# SEO files
echo "Deploying robots.txt + sitemap.xml..."
scp "$LOCAL/robots.txt" "$VPS:$REMOTE/robots.txt" 2>/dev/null || true
scp "$LOCAL/sitemap.xml" "$VPS:$REMOTE/sitemap.xml" 2>/dev/null || true

# MfT-Launch site pages (launcher, reactor dashboard, etc.)
LAUNCH_SITE="../MfT-Launch/site"
if [ -d "$LAUNCH_SITE" ]; then
    echo "Deploying /launcher/ (MfT-Launch site)..."
    ssh "$VPS" "mkdir -p $REMOTE/launcher"
    for f in "$LAUNCH_SITE"/*.html; do
        scp "$f" "$VPS:$REMOTE/launcher/"
    done
    # .well-known for agent discovery
    if [ -d "$LAUNCH_SITE/.well-known" ]; then
        ssh "$VPS" "mkdir -p $REMOTE/.well-known"
        scp -r "$LAUNCH_SITE/.well-known/"* "$VPS:$REMOTE/.well-known/"
    fi
fi

echo ""
echo "=== Deploy complete ==="
echo "Verify at: https://tasern.quest"
echo "  Landing: https://tasern.quest/"
echo "  Burn stats: https://tasern.quest/mft/"
echo "  Agent discovery: https://tasern.quest/llms.txt"
echo "  AI plugin: https://tasern.quest/.well-known/ai-plugin.json"
echo "  MCP discovery: https://tasern.quest/.well-known/mcp.json"
echo "  Launcher: https://tasern.quest/launcher/unrugable.html"
echo "  Reactor Dashboard: https://tasern.quest/launcher/reactor-dashboard.html"
echo "  Network Map: https://tasern.quest/launcher/reactor-map.html"
