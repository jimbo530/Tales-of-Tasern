// ═══════════════════════════════════════════════════════════════
// chain-sync.js — On-chain POOP vault & tier token sync
//
// Reads real on-chain state every 30s (alongside existing polling):
//   - HouseNFT V2: poopStored(houseId) → updates housePoop[]
//   - HouseNFT V2: poopCap(houseId) → updates housePoopCaps[]
//   - BaselingState V3: tier token balances → updates skillCredits
//   - PoopRouterV2: totalRouted → display stat
//
// Include in index.html: <script src="chain-sync.js"></script>
// Call initChainSync(provider, playerAddress) after wallet connect
// ═══════════════════════════════════════════════════════════════

const CHAIN_SYNC = (() => {
  // Contract addresses
  const HOUSE_NFT_ADDR = '0x70Ff566A417ece44784196106afdbecDAaA3b511';
  const BASELING_STATE_ADDR = '0x4b123766152397BAa035a52808DDDCD794c8a32d';
  const POOP_ROUTER_ADDR = '0xB56bC9377b678C1acA8C1d15844396d2B3EBe684';
  const ASSIGNMENTS_ADDR = '0xabC2e93CF79F89E0874741366E9C33D73D7E9C6c';
  const POOP_ADDR = '0x126555aecBAC290b25644e4b7f29c016aE95f4dc';

  // ABIs (minimal)
  const HOUSE_ABI = [
    'function poopStored(uint256 houseId) view returns (uint256)',
    'function poopCap(uint256 houseId) view returns (uint256)',
    'function tokensOf(address wallet) view returns (uint256[])',
    'function totalSupply() view returns (uint256)',
    'function baselingsInHouse(uint256 houseId) view returns (uint256[])',
  ];
  const STATE_ABI = [
    'function balanceOf(address,uint256) view returns (uint256)',
    'function getBalances(address,uint256[]) view returns (uint256[])',
    'function poolHolderCount(uint256) view returns (uint256)',
    'function getPoolYieldBps(uint256) view returns (uint256,uint256)',
  ];
  const ROUTER_ABI = [
    'function totalRouted() view returns (uint256)',
    'function houseCarryCapacity(uint256) view returns (uint256)',
    'function contributions(address) view returns (uint256)',
  ];
  const ASSIGNMENTS_ABI_MINI = [
    'function getPlayerAssignments(address) view returns (uint256[])',
    'function getAssignment(uint256) view returns (uint256,address,uint8,uint256,uint256,uint256[],bool)',
  ];

  // State
  let _provider = null;
  let _player = null;
  let _houseContract = null;
  let _stateContract = null;
  let _routerContract = null;
  let _assignmentsContract = null;
  let _syncInterval = null;
  let _lastSync = 0;

  // Tier token IDs for each pool (poolIndex * 100 + tier)
  // 24 pools × 21 tiers = 504 tokens
  const POOL_NAMES = ['burgers','tgn','brett','azusd','egp','buster','char','fun',
                      'usdc_pp','weth_pp','btc_pp','mft_pp','nanny_0','nanny_1',
                      'hauler_0','hauler_1','hauler_2','hauler_3','burn_0','burn_1',
                      'burn_2','burn_3','burn_4','burn_5'];
  const MAX_TIER = 20;

  // Public sync results (game reads these)
  const syncState = {
    housePoopOnChain: [],     // per-house POOP stored on-chain
    housePoopCapsOnChain: [], // per-house cap on-chain
    houseTokenIds: [],        // NFT IDs of player houses
    tierBalances: {},         // poolName → total balance across all tiers
    totalRouted: '0',        // all-time POOP routed through system
    playerContributions: '0', // player's total contribution
    haulerCapacity: {},       // houseId → carry capacity
    lastSyncTime: 0,
    syncing: false,
    error: null,
  };

  // Initialize
  function init(provider, playerAddress) {
    if (!provider || !playerAddress) return;
    _provider = provider;
    _player = playerAddress;

    _houseContract = new ethers.Contract(HOUSE_NFT_ADDR, HOUSE_ABI, provider);
    _stateContract = new ethers.Contract(BASELING_STATE_ADDR, STATE_ABI, provider);
    _routerContract = new ethers.Contract(POOP_ROUTER_ADDR, ROUTER_ABI, provider);
    _assignmentsContract = new ethers.Contract(ASSIGNMENTS_ADDR, ASSIGNMENTS_ABI_MINI, provider);

    // Initial sync
    syncAll();

    // Poll every 30s
    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = setInterval(syncAll, 30000);
  }

  // Full sync
  async function syncAll() {
    if (syncState.syncing) return;
    syncState.syncing = true;
    syncState.error = null;

    try {
      await syncHousePoop();
      await syncTierBalances();
      await syncRouterStats();
      syncState.lastSyncTime = Date.now();

      // Push on-chain values into game state
      applyToGameState();
    } catch (e) {
      syncState.error = e.message;
      console.warn('[chain-sync] Error:', e.message);
    }

    syncState.syncing = false;
  }

  // Read house POOP vaults from chain
  async function syncHousePoop() {
    if (!_houseContract || !_player) return;

    try {
      const tokens = await _houseContract.tokensOf(_player);
      syncState.houseTokenIds = tokens.map(t => Number(t));

      syncState.housePoopOnChain = [];
      syncState.housePoopCapsOnChain = [];
      syncState.haulerCapacity = {};

      for (const tokenId of syncState.houseTokenIds) {
        const stored = await _houseContract.poopStored(tokenId);
        const cap = await _houseContract.poopCap(tokenId);
        syncState.housePoopOnChain.push(parseFloat(ethers.formatEther(stored)));
        syncState.housePoopCapsOnChain.push(parseFloat(ethers.formatEther(cap)));

        // Hauler capacity for this house
        try {
          const carry = await _routerContract.houseCarryCapacity(tokenId);
          syncState.haulerCapacity[tokenId] = parseFloat(ethers.formatEther(carry));
        } catch (e) { syncState.haulerCapacity[tokenId] = 0; }
      }
    } catch (e) {
      console.warn('[chain-sync] House poop read failed:', e.message);
    }
  }

  // Read tier token balances from BaselingState
  async function syncTierBalances() {
    if (!_stateContract || !_player) return;

    try {
      // Build token ID list for pools 0-7 (main garden/PP pools), tiers 0-5
      const ids = [];
      for (let pool = 0; pool < 8; pool++) {
        for (let tier = 0; tier <= 5; tier++) {
          ids.push(pool * 100 + tier);
        }
      }

      const balances = await _stateContract.getBalances(_player, ids);
      syncState.tierBalances = {};

      for (let i = 0; i < ids.length; i++) {
        const poolIdx = Math.floor(ids[i] / 100);
        const poolName = POOL_NAMES[poolIdx] || `pool_${poolIdx}`;
        if (!syncState.tierBalances[poolName]) syncState.tierBalances[poolName] = 0;
        syncState.tierBalances[poolName] += parseFloat(ethers.formatEther(balances[i]));
      }
    } catch (e) {
      console.warn('[chain-sync] Tier balance read failed:', e.message);
    }
  }

  // Read router stats
  async function syncRouterStats() {
    if (!_routerContract || !_player) return;

    try {
      const routed = await _routerContract.totalRouted();
      syncState.totalRouted = ethers.formatEther(routed);

      const contrib = await _routerContract.contributions(_player);
      syncState.playerContributions = ethers.formatEther(contrib);
    } catch (e) {
      console.warn('[chain-sync] Router stats failed:', e.message);
    }
  }

  // Apply on-chain values to game state variables
  function applyToGameState() {
    // Update housePoop from chain (chain is truth)
    if (typeof housePoop !== 'undefined' && syncState.housePoopOnChain.length > 0) {
      for (let i = 0; i < syncState.housePoopOnChain.length && i < housePoop.length; i++) {
        // Only override if chain value is higher (chain can't go backwards without spending)
        if (syncState.housePoopOnChain[i] > housePoop[i]) {
          housePoop[i] = syncState.housePoopOnChain[i];
        }
      }
    }

    // Update caps from chain
    if (typeof housePoopCaps !== 'undefined' && syncState.housePoopCapsOnChain.length > 0) {
      for (let i = 0; i < syncState.housePoopCapsOnChain.length && i < housePoopCaps.length; i++) {
        housePoopCaps[i] = syncState.housePoopCapsOnChain[i];
      }
    }

    // Update house token IDs
    if (typeof houseTokenIds !== 'undefined') {
      for (let i = 0; i < syncState.houseTokenIds.length; i++) {
        houseTokenIds[i] = syncState.houseTokenIds[i];
      }
    }

    // Fire HUD update if function exists
    if (typeof updateHUD === 'function') updateHUD();
  }

  // Get formatted display for a pool's tier balance
  function getPoolDisplay(poolName) {
    const bal = syncState.tierBalances[poolName] || 0;
    if (bal === 0) return 'Lv.0';
    if (bal < 10) return 'Lv.1';
    if (bal < 50) return 'Lv.2';
    if (bal < 200) return 'Lv.3';
    if (bal < 1000) return 'Lv.4';
    return 'Lv.5';
  }

  // Get hauler efficiency display for a house
  function getHaulerDisplay(houseIdx) {
    const tokenId = syncState.houseTokenIds[houseIdx];
    if (!tokenId) return 'No haulers';
    const carry = syncState.haulerCapacity[tokenId] || 0;
    if (carry === 0) return 'No haulers';
    return `${carry.toFixed(0)} POOP/cycle`;
  }

  // Get poop generation rate (from last sync data)
  function getPoopRate() {
    const total = syncState.housePoopOnChain.reduce((a, b) => a + b, 0);
    return total > 0 ? `${total.toFixed(1)} POOP in vaults` : 'Earning from LP volume...';
  }

  // Cleanup
  function destroy() {
    if (_syncInterval) clearInterval(_syncInterval);
    _syncInterval = null;
    _provider = null;
    _player = null;
  }

  return {
    init,
    syncAll,
    syncState,
    getPoolDisplay,
    getHaulerDisplay,
    getPoopRate,
    destroy,
    POOL_NAMES,
  };
})();

// Global access
if (typeof window !== 'undefined') {
  window.CHAIN_SYNC = CHAIN_SYNC;
  window.initChainSync = CHAIN_SYNC.init;
}
