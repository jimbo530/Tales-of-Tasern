const express = require('express');
const path = require('path');
const { ethers } = require('ethers');

const fs = require('fs');

const app = express();
app.use(express.json());
const PORT = 3001;

// --- Custom names storage ---
const NAMES_FILE = path.join(__dirname, 'names.json');
let customNames = {};
try { customNames = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8')); } catch(e) {}

// --- Contract config ---
const CONTRACT_ADDRESS = '0xFCb825491490284189C75fD330Fd08Df5E9217b9';
const BASE_RPC = 'https://mainnet.base.org';
const ABI = [
  'function baselings(uint256) view returns (uint8 state, uint8 family, bool giant, uint64 birthTime, uint64 lastFed, uint32 feedCount, uint16 deathCount)',
  'function totalMinted() view returns (uint256)'
];

const provider = new ethers.JsonRpcProvider(BASE_RPC);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// --- Mappings ---
const FAMILY_NAMES = { 0: 'TGN', 1: 'BURGERS', 2: 'AZUSD' };
const FAMILY_COLORS = { 0: 'Green', 1: 'Brown', 2: 'White' };
const FAMILY_IMAGE = { 0: 'tgn', 1: 'burgers', 2: 'azusd' };
const STATE_NAMES = { 0: 'Egg', 1: 'Baby', 2: 'Teen', 3: 'Adult', 4: 'Legend', 5: 'Dead' };

// --- Cache (5 min TTL) ---
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

// --- Routes ---

// Serve images from /images directory
app.use('/images', express.static(path.join(__dirname, 'images')));

// Metadata endpoint
app.get('/metadata/:tokenId', async (req, res) => {
  const tokenId = req.params.tokenId;

  // Validate tokenId is a positive integer
  if (!/^\d+$/.test(tokenId) || tokenId === '0') {
    return res.status(400).json({ error: 'Invalid tokenId' });
  }

  try {
    // Check cache first
    const cacheKey = `baseling_${tokenId}`;
    let baseling = getCached(cacheKey);

    if (!baseling) {
      const result = await contract.baselings(tokenId);
      baseling = {
        state: Number(result.state),
        family: Number(result.family),
        giant: result.giant,
        birthTime: Number(result.birthTime),
        lastFed: Number(result.lastFed),
        feedCount: Number(result.feedCount),
        deathCount: Number(result.deathCount)
      };

      // Only cache if baseling exists (birthTime > 0)
      if (baseling.birthTime > 0) {
        setCache(cacheKey, baseling);
      }
    }

    // If birthTime is 0, token doesn't exist
    if (baseling.birthTime === 0) {
      return res.status(404).json({ error: `Baseling #${tokenId} does not exist` });
    }

    const familyName = FAMILY_NAMES[baseling.family] || 'Unknown';
    const familyImage = FAMILY_IMAGE[baseling.family] || 'unknown';
    const stateName = STATE_NAMES[baseling.state] || 'Unknown';

    const metadata = {
      name: customNames[tokenId] || `Baseling #${tokenId}`,
      description: 'A Baseling NFT pet on Base chain',
      image: `https://tasern.quest/baseling/images/${familyImage}.png`,
      external_url: 'https://tasern.quest/baseling',
      attributes: [
        { trait_type: 'Family', value: familyName },
        { trait_type: 'Giant', value: baseling.giant ? 'Yes' : 'No' },
        { trait_type: 'State', value: stateName },
        { trait_type: 'Birth Time', display_type: 'date', value: baseling.birthTime }
      ]
    };

    res.json(metadata);
  } catch (err) {
    console.error(`Error fetching baseling #${tokenId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch on-chain data' });
  }
});

// Set custom name for a baseling
app.post('/name/:tokenId', async (req, res) => {
  const tokenId = req.params.tokenId;
  const { name, wallet } = req.body;

  if (!/^\d+$/.test(tokenId) || tokenId === '0') {
    return res.status(400).json({ error: 'Invalid tokenId' });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 24) {
    return res.status(400).json({ error: 'Name must be 1-24 characters' });
  }

  // Verify ownership via on-chain ownerOf
  if (wallet) {
    try {
      const ownerABI = ['function ownerOf(uint256) view returns (address)'];
      const nft = new ethers.Contract(CONTRACT_ADDRESS, ownerABI, provider);
      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.toLowerCase()) {
        return res.status(403).json({ error: 'Not the owner of this baseling' });
      }
    } catch(e) {
      return res.status(400).json({ error: 'Could not verify ownership' });
    }
  }

  customNames[tokenId] = name.trim();
  fs.writeFileSync(NAMES_FILE, JSON.stringify(customNames, null, 2));

  // Clear metadata cache so name shows immediately
  cache.delete(`baseling_${tokenId}`);

  res.json({ ok: true, tokenId, name: customNames[tokenId] });
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', contract: CONTRACT_ADDRESS, chain: 'Base (8453)' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Baseling API running on port ${PORT}`);
  console.log(`Metadata: http://localhost:${PORT}/metadata/:tokenId`);
  console.log(`Images:   http://localhost:${PORT}/images/:name`);
});
