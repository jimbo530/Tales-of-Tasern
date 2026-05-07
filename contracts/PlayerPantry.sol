// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PlayerPantry — Per-player food storage for Baselings
 *
 * Food = LP tokens (token/MfT pairs) bought at the GroceryStore.
 * Cupboard: 7-day spoilage timer, resets on new food purchase (NOT on feed).
 * Freezer: no spoilage, limited capacity.
 * Spoiled food LP → PowerPlant (community gain from neglect).
 *
 * Players share ONE pantry across all their baselings.
 * Feeding picks which baseling gets LP from the shared supply.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IBaselingNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function depositAndFeed(uint256 tokenId, address pair, uint256 amount) external;
    function wethPerPoop() external view returns (uint256);
    function pairs(address pair) external view returns (bool accepted, uint256 wethPerLP);
}

interface IPoopToken {
    function mint(address to, uint256 amount) external;
}

// ═══════════════════════════════════════════════════════════════════════════

contract PlayerPantry {

    address public owner;
    IBaselingNFT public baselingNFT;
    IPoopToken public poop;
    address public powerPlant;

    uint256 public constant SPOIL_DURATION = 7 days;

    // --- Storage per player per LP pair ---
    // Cupboard: has spoilage timer
    mapping(address => mapping(address => uint256)) public cupboardAmount;
    mapping(address => mapping(address => uint64))  public cupboardTime;   // last deposit timestamp

    // Freezer: no spoilage
    mapping(address => mapping(address => uint256)) public freezerAmount;

    // Capacity (upgradeable via house purchases)
    mapping(address => uint256) public cupboardCapacity;  // max LP tokens (0 = default)
    mapping(address => uint256) public freezerCapacity;

    uint256 public defaultCupboardCap = 1e18;   // 1 LP token default
    uint256 public defaultFreezerCap  = 0;       // no freezer by default

    // Accepted LP pairs (same as BaselingNFT pair list)
    mapping(address => bool) public acceptedPair;

    // Authorized depositors (GroceryStore, BaselingRouter)
    mapping(address => bool) public authorized;

    // --- Events ---
    event CupboardDeposit(address indexed player, address indexed pair, uint256 amount);
    event FreezerDeposit(address indexed player, address indexed pair, uint256 amount);
    event FedBaseling(address indexed player, uint256 indexed tokenId, address indexed pair, uint256 amount);
    event FoodSpoiled(address indexed player, address indexed pair, uint256 amount);
    event CapacityUpgraded(address indexed player, string storage_type, uint256 newCap);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _baselingNFT, address _powerPlant, address _poop) {
        owner = msg.sender;
        baselingNFT = IBaselingNFT(_baselingNFT);
        powerPlant = _powerPlant;
        poop = IPoopToken(_poop);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Deposit Food — called by GroceryStore after creating LP
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Deposit LP to player's cupboard. Timer resets on every deposit.
    /// Called by GroceryStore or authorized contracts.
    function depositToCupboard(address player, address pair, uint256 amount) external onlyAuthorized {
        require(acceptedPair[pair], "pair not accepted");
        require(amount > 0, "zero");

        // Check if existing cupboard food is spoiled — send to power plant first
        _checkAndSpoil(player, pair);

        // Check capacity
        uint256 cap = cupboardCapacity[player];
        if (cap == 0) cap = defaultCupboardCap;
        uint256 current = cupboardAmount[player][pair];
        require(current + amount <= cap, "cupboard full");

        // Transfer LP from caller (GroceryStore)
        IERC20(pair).transferFrom(msg.sender, address(this), amount);

        cupboardAmount[player][pair] = current + amount;
        cupboardTime[player][pair] = uint64(block.timestamp); // RESET timer on buy

        emit CupboardDeposit(player, pair, amount);
    }

    /// @notice Deposit LP to player's freezer. No spoilage.
    function depositToFreezer(address player, address pair, uint256 amount) external onlyAuthorized {
        require(acceptedPair[pair], "pair not accepted");
        require(amount > 0, "zero");

        uint256 cap = freezerCapacity[player];
        if (cap == 0) cap = defaultFreezerCap;
        require(cap > 0, "no freezer");
        uint256 current = freezerAmount[player][pair];
        require(current + amount <= cap, "freezer full");

        IERC20(pair).transferFrom(msg.sender, address(this), amount);

        freezerAmount[player][pair] = current + amount;

        emit FreezerDeposit(player, pair, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Feed Baseling — move LP from pantry to baseling vault
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Feed a baseling from cupboard or freezer. Resets baseling's 3-day death timer.
    /// @param tokenId Baseling NFT to feed
    /// @param pair LP pair to feed with
    /// @param amount LP amount to move
    /// @param fromFreezer true = pull from freezer, false = pull from cupboard
    function feedBaseling(uint256 tokenId, address pair, uint256 amount, bool fromFreezer) external {
        require(baselingNFT.ownerOf(tokenId) == msg.sender, "not baseling owner");
        require(amount > 0, "zero");

        if (fromFreezer) {
            require(freezerAmount[msg.sender][pair] >= amount, "not enough in freezer");
            freezerAmount[msg.sender][pair] -= amount;
        } else {
            // Check spoilage first
            _checkAndSpoil(msg.sender, pair);
            require(cupboardAmount[msg.sender][pair] >= amount, "not enough in cupboard");
            cupboardAmount[msg.sender][pair] -= amount;
        }

        // Approve LP to BaselingNFT and call depositAndFeed
        IERC20(pair).approve(address(baselingNFT), amount);
        baselingNFT.depositAndFeed(tokenId, pair, amount);

        // POOP reward: 1 POOP per $0.01 of LP value deposited
        uint256 wpp = baselingNFT.wethPerPoop();
        (, uint256 wethPerLP) = baselingNFT.pairs(pair);
        if (wpp > 0 && wethPerLP > 0) {
            uint256 wethValue = (amount * wethPerLP) / 1e18;
            uint256 poopEarned = (wethValue * 1e18) / wpp;
            if (poopEarned > 0) poop.mint(msg.sender, poopEarned);
        }

        emit FedBaseling(msg.sender, tokenId, pair, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Spoilage — 7-day timer, spoiled LP → PowerPlant
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Anyone can trigger spoilage check (keeper or piggybacked)
    function checkSpoilage(address player, address pair) external {
        _checkAndSpoil(player, pair);
    }

    function _checkAndSpoil(address player, address pair) internal {
        uint256 amount = cupboardAmount[player][pair];
        if (amount == 0) return;

        uint64 depositTime = cupboardTime[player][pair];
        if (block.timestamp <= depositTime + SPOIL_DURATION) return;

        // SPOILED — send all cupboard LP to power plant
        cupboardAmount[player][pair] = 0;
        cupboardTime[player][pair] = 0;

        if (powerPlant != address(0)) {
            IERC20(pair).transfer(powerPlant, amount);
        }

        emit FoodSpoiled(player, pair, amount);
    }

    /// @notice Check if a player's cupboard is expired for a pair
    function isExpired(address player, address pair) external view returns (bool) {
        uint256 amount = cupboardAmount[player][pair];
        if (amount == 0) return false;
        return block.timestamp > cupboardTime[player][pair] + SPOIL_DURATION;
    }

    /// @notice Time remaining before cupboard food spoils (0 = already spoiled)
    function timeToSpoil(address player, address pair) external view returns (uint256) {
        uint256 amount = cupboardAmount[player][pair];
        if (amount == 0) return 0;
        uint256 expiry = cupboardTime[player][pair] + SPOIL_DURATION;
        if (block.timestamp >= expiry) return 0;
        return expiry - block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════

    function setAcceptedPair(address pair, bool status) external onlyOwner {
        acceptedPair[pair] = status;
    }

    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
    }

    function setCupboardCapacity(address player, uint256 cap) external onlyOwner {
        cupboardCapacity[player] = cap;
        emit CapacityUpgraded(player, "cupboard", cap);
    }

    function setFreezerCapacity(address player, uint256 cap) external onlyOwner {
        freezerCapacity[player] = cap;
        emit CapacityUpgraded(player, "freezer", cap);
    }

    function setDefaultCaps(uint256 cupboard, uint256 freezer) external onlyOwner {
        defaultCupboardCap = cupboard;
        defaultFreezerCap = freezer;
    }

    function setBaselingNFT(address _nft) external onlyOwner {
        baselingNFT = IBaselingNFT(_nft);
    }

    function setPoopToken(address _poop) external onlyOwner {
        poop = IPoopToken(_poop);
    }

    function setPowerPlant(address _plant) external onlyOwner {
        powerPlant = _plant;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
