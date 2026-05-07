// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * BaselingNFT — ERC721 + permanent per-tokenId LP vault + fee-based 💩 minting
 *
 * The baseling IS its vault. LP deposited against a tokenId is locked forever.
 * Whoever owns the NFT owns the yield rights. Sell the baseling = sell the vault.
 *
 * States:
 *   0 = EGG      — unhatched, no 💩 accrual, LP deposits build the vault
 *   1 = ALIVE    — active, 💩 minted to ownerOf(tokenId) from LP fees
 *   2 = FROZEN   — cryo freeze (marketplace), 💩 is burned (on-chain deflation)
 *   3 = DEAD     — starved (3 days unfed), 💩 is burned until resurrected
 *
 * Fee tracking:
 *   Uses sqrt(k)/totalSupply index on V2 pairs to measure fee accrual.
 *   Volume drives fee growth. Fees converted to WETH value via wethPerLP.
 *   💩 pegged to ETH: 1 💩 = wethPerPoop (~$0.01 worth of ETH).
 *
 * Families:
 *   0 = TGN  (green — trees, frogs)
 *   1 = BURGERS (brown — bears)
 *   2 = AZUSD (white — bulls, cows)
 *   Each family maps to a specific token/MfT LP pair.
 */

// ── Interfaces ──────────────────────────────────────────────────────────

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function totalSupply() external view returns (uint256);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IPoopToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

// ═══════════════════════════════════════════════════════════════════════════

contract BaselingNFT {

    // --- ERC721 Core ---
    string public constant name = "Baseling";
    string public constant symbol = "BSLNG";

    uint256 public totalMinted;
    address public owner;
    IPoopToken public poop;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // --- Baseling States ---
    uint8 constant EGG    = 0;
    uint8 constant ALIVE  = 1;
    uint8 constant FROZEN = 2;
    uint8 constant DEAD   = 3;

    uint256 public constant DEATH_DURATION = 3 days;

    struct Baseling {
        uint8  state;
        uint8  family;         // 0=TGN, 1=BURGERS, 2=AZUSD
        bool   giant;          // 2x sprite, guaranteed at giantEggPrice
        uint64 birthTime;
        uint64 lastFed;
        uint32 feedCount;
        uint16 deathCount;
    }
    mapping(uint256 => Baseling) public baselings;

    event StateChanged(uint256 indexed tokenId, uint8 oldState, uint8 newState);
    event Deposited(uint256 indexed tokenId, address indexed pair, uint256 amount);
    event Fed(uint256 indexed tokenId, address indexed pair, uint256 amount);
    event PoopDistributed(uint256 indexed tokenId, address indexed to, uint256 poopAmount, bool burned);
    event EggMinted(uint256 indexed tokenId, address indexed to, uint8 family, bool giant);
    event PowerPlantFunded(uint256 amount);

    // --- WETH + Power Plant ---
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public powerPlant;          // receives 1% of egg mints + infrastructure WETH
    uint256 public powerPlantBalance;   // WETH accumulated for power plant

    // --- Egg Pricing (in WETH) ---
    uint256 public randomEggPrice;      // ~$0.10 of WETH
    uint256 public sortedEggPrice;      // ~$1.00 of WETH
    uint256 public giantEggPrice;       // ~$5.00 of WETH — guaranteed giant (2x sprite)

    // --- 💩 Peg ---
    uint256 public wethPerPoop;

    // --- Authorized Contracts (pantry, router) ---
    mapping(address => bool) public authorized;

    // --- LP Vault (per tokenId, per pair) ---

    struct PairConfig {
        bool    accepted;
        uint256 wethPerLP;      // WETH value of 1 LP token (18 decimals)
    }
    mapping(address => PairConfig) public pairs;
    address[] public pairList;

    // Family → LP pair mapping (0=TGN/MfT, 1=BURGERS/MfT, 2=AZUSD/MfT)
    address[3] public familyPairs;

    struct LPStake {
        uint256 amount;          // LP tokens locked forever
        uint256 lastFeeIndex;    // sqrt(k)/totalSupply at last claim
        uint256 poopAccum;       // fractional 💩 accumulator
    }
    // tokenId => pair => stake
    mapping(uint256 => mapping(address => LPStake)) public vaults;
    // tokenId => list of pairs staked
    mapping(uint256 => address[]) public vaultPairs;

    // WETH seed from egg purchase, waiting to become LP (router converts)
    mapping(uint256 => uint256) public vaultSeeds;

    // --- Global Stats ---
    uint256 public totalLPLocked;
    uint256 public totalPoopMinted;
    uint256 public totalPoopBurned;
    uint256 public totalFeesWETH;

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf[tokenId] == msg.sender, "not token owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    constructor(
        address _poop,
        uint256 _wethPerPoop,
        uint256 _randomEggPrice,
        uint256 _sortedEggPrice,
        uint256 _giantEggPrice
    ) {
        owner = msg.sender;
        poop = IPoopToken(_poop);
        wethPerPoop = _wethPerPoop;
        randomEggPrice = _randomEggPrice;
        sortedEggPrice = _sortedEggPrice;
        giantEggPrice = _giantEggPrice;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ERC721
    // ═══════════════════════════════════════════════════════════════════════

    function approve(address to, uint256 tokenId) external {
        address tokenOwner = ownerOf[tokenId];
        require(msg.sender == tokenOwner || isApprovedForAll[tokenOwner][msg.sender], "not authorized");
        getApproved[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(from == ownerOf[tokenId], "not owner");
        require(
            msg.sender == from ||
            msg.sender == getApproved[tokenId] ||
            isApprovedForAll[from][msg.sender],
            "not authorized"
        );
        require(to != address(0), "zero address");

        // Auto-claim pending 💩 to old owner before transfer
        _claimAll(tokenId);

        getApproved[tokenId] = address(0);
        balanceOf[from]--;
        balanceOf[to]++;
        ownerOf[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            require(
                IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) == IERC721Receiver.onERC721Received.selector,
                "unsafe recipient"
            );
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd  // ERC721
            || interfaceId == 0x01ffc9a7  // ERC165
            || interfaceId == 0x5b5e139f; // ERC721Metadata
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Mint Egg — paid in WETH, 99% seed for LP, 1% to power plant
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Mint a random egg — picks 1 of 3 families randomly
    function mintRandom() external returns (uint256 tokenId) {
        uint8 family = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, totalMinted + 1))) % 3);
        tokenId = _mintEgg(randomEggPrice, family, false);
    }

    /// @notice Mint a sorted egg — player picks family (0=TGN, 1=BURGERS, 2=AZUSD)
    function mintSorted(uint8 family) external returns (uint256 tokenId) {
        require(family <= 2, "invalid family");
        tokenId = _mintEgg(sortedEggPrice, family, false);
    }

    /// @notice Mint a giant egg — guaranteed 2x sprite, random family
    function mintGiant() external returns (uint256 tokenId) {
        uint8 family = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, totalMinted + 1))) % 3);
        tokenId = _mintEgg(giantEggPrice, family, true);
    }

    function _mintEgg(uint256 price, uint8 family, bool _giant) internal returns (uint256 tokenId) {
        require(price > 0, "price not set");
        // Collect WETH
        IERC20(WETH).transferFrom(msg.sender, address(this), price);

        // 1% to power plant, 99% becomes LP seed
        uint256 plantCut = price / 100;
        uint256 vaultSeed = price - plantCut;
        powerPlantBalance += plantCut;

        // Mint the NFT
        tokenId = ++totalMinted;
        ownerOf[tokenId] = msg.sender;
        balanceOf[msg.sender]++;
        baselings[tokenId] = Baseling({
            state: EGG,
            family: family,
            giant: _giant,
            birthTime: uint64(block.timestamp),
            lastFed: uint64(block.timestamp),
            feedCount: 0,
            deathCount: 0
        });

        // 99% WETH held until routed to LP via BaselingRouter.convertSeed()
        vaultSeeds[tokenId] = vaultSeed;

        emit Transfer(address(0), msg.sender, tokenId);
        emit EggMinted(tokenId, msg.sender, family, _giant);
        emit PowerPlantFunded(plantCut);
    }

    /// @notice Router claims seed WETH to convert to LP off-chain
    function claimSeed(uint256 tokenId) external onlyAuthorized returns (uint256 seed) {
        seed = vaultSeeds[tokenId];
        require(seed > 0, "no seed");
        vaultSeeds[tokenId] = 0;
        IERC20(WETH).transfer(msg.sender, seed);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // State Transitions
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Hatch egg → alive
    function hatch(uint256 tokenId) external onlyTokenOwner(tokenId) {
        Baseling storage b = baselings[tokenId];
        require(b.state == EGG, "not egg");
        b.state = ALIVE;
        b.lastFed = uint64(block.timestamp);
        emit StateChanged(tokenId, EGG, ALIVE);
    }

    /// @notice Cryo freeze for marketplace — 💩 will be burned during freeze
    function freeze(uint256 tokenId) external onlyTokenOwner(tokenId) {
        Baseling storage b = baselings[tokenId];
        require(b.state == ALIVE, "not alive");
        _claimAll(tokenId);
        b.state = FROZEN;
        emit StateChanged(tokenId, ALIVE, FROZEN);
    }

    /// @notice Unfreeze from cryo — resumes normal 💩 minting, resets death timer
    function unfreeze(uint256 tokenId) external onlyTokenOwner(tokenId) {
        Baseling storage b = baselings[tokenId];
        require(b.state == FROZEN, "not frozen");
        _claimAll(tokenId);
        b.state = ALIVE;
        b.lastFed = uint64(block.timestamp);
        emit StateChanged(tokenId, FROZEN, ALIVE);
    }

    /// @notice Mark as dead — anyone can call if 3-day death timer expired
    function kill(uint256 tokenId) external {
        Baseling storage b = baselings[tokenId];
        require(b.state == ALIVE, "not alive");
        require(block.timestamp > b.lastFed + DEATH_DURATION, "not starved");
        _claimAll(tokenId);
        b.state = DEAD;
        b.deathCount++;
        emit StateChanged(tokenId, ALIVE, DEAD);
    }

    /// @notice Resurrect dead baseling
    function resurrect(uint256 tokenId) external onlyTokenOwner(tokenId) {
        Baseling storage b = baselings[tokenId];
        require(b.state == DEAD, "not dead");
        _claimAll(tokenId);
        b.state = ALIVE;
        b.lastFed = uint64(block.timestamp);
        emit StateChanged(tokenId, DEAD, ALIVE);
    }

    /// @notice Check if baseling is dead (3 days without feeding)
    function isDead(uint256 tokenId) external view returns (bool) {
        Baseling storage b = baselings[tokenId];
        return b.state == ALIVE && block.timestamp > b.lastFed + DEATH_DURATION;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LP Vault — Forever Locked
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Deposit LP into a baseling's vault — LOCKED FOREVER
    /// Called by authorized contracts (BaselingRouter) when seeding egg vault
    function deposit(uint256 tokenId, address pair, uint256 amount) external onlyAuthorized {
        require(pairs[pair].accepted, "pair not accepted");
        require(amount > 0, "zero");

        _claim(tokenId, pair);

        IERC20(pair).transferFrom(msg.sender, address(this), amount);

        LPStake storage s = vaults[tokenId][pair];
        if (s.amount == 0) {
            vaultPairs[tokenId].push(pair);
        }
        s.amount += amount;
        s.lastFeeIndex = _currentFeeIndex(pair);

        totalLPLocked += amount;
        emit Deposited(tokenId, pair, amount);
    }

    /// @notice Feed baseling — deposit LP from pantry and reset death timer
    /// Called by authorized contracts (PlayerPantry) when player feeds
    function depositAndFeed(uint256 tokenId, address pair, uint256 amount) external onlyAuthorized {
        require(pairs[pair].accepted, "pair not accepted");
        require(amount > 0, "zero");
        Baseling storage b = baselings[tokenId];
        require(b.state == ALIVE, "not alive");

        _claim(tokenId, pair);

        IERC20(pair).transferFrom(msg.sender, address(this), amount);

        LPStake storage s = vaults[tokenId][pair];
        if (s.amount == 0) {
            vaultPairs[tokenId].push(pair);
        }
        s.amount += amount;
        s.lastFeeIndex = _currentFeeIndex(pair);

        totalLPLocked += amount;

        b.lastFed = uint64(block.timestamp);
        b.feedCount++;

        emit Fed(tokenId, pair, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 💩 Distribution — Auto, No Claiming
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Keeper calls every 4hrs to auto-distribute POOP
    /// Also piggybacked on every player action via internal calls
    function distributeBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _claimAll(tokenIds[i]);
        }
    }

    function _claimAll(uint256 tokenId) internal {
        address[] storage pList = vaultPairs[tokenId];
        for (uint256 i = 0; i < pList.length; i++) {
            _claim(tokenId, pList[i]);
        }
    }

    function _claim(uint256 tokenId, address pair) internal {
        LPStake storage s = vaults[tokenId][pair];
        if (s.amount == 0) return;

        uint256 currentIndex = _currentFeeIndex(pair);
        uint256 lastIndex = s.lastFeeIndex;
        if (lastIndex == 0) { s.lastFeeIndex = currentIndex; return; }
        if (currentIndex <= lastIndex) { s.lastFeeIndex = currentIndex; return; }

        // Fee growth from trading volume
        uint256 feeGrowth = currentIndex - lastIndex;

        uint256 pairWethPerLP = pairs[pair].wethPerLP;
        if (pairWethPerLP == 0 || wethPerPoop == 0) {
            s.lastFeeIndex = currentIndex;
            return;
        }

        // WETH value of fees = feeGrowth% * user's LP value in WETH
        uint256 feeValueWETH = (feeGrowth * s.amount * pairWethPerLP) / (lastIndex * 1e18);

        totalFeesWETH += feeValueWETH;

        // 💩 to mint = feeValueWETH / wethPerPoop
        s.poopAccum += (feeValueWETH * 1e18) / wethPerPoop;

        // Issue whole 💩 tokens
        uint256 poopToIssue = (s.poopAccum / 1e18) * 1e18;
        s.poopAccum -= poopToIssue;

        if (poopToIssue > 0) {
            uint8 state = baselings[tokenId].state;

            if (state == ALIVE) {
                poop.mint(ownerOf[tokenId], poopToIssue);
                totalPoopMinted += poopToIssue;
                emit PoopDistributed(tokenId, ownerOf[tokenId], poopToIssue, false);
            } else if (state == FROZEN || state == DEAD) {
                poop.burn(poopToIssue);
                totalPoopBurned += poopToIssue;
                emit PoopDistributed(tokenId, address(0), poopToIssue, true);
            }
            // EGG = no mint, no burn
        }

        s.lastFeeIndex = currentIndex;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Fee Index — sqrt(k) / totalSupply (volume-driven)
    // ═══════════════════════════════════════════════════════════════════════

    function _currentFeeIndex(address pair) internal view returns (uint256) {
        IUniswapV2Pair p = IUniswapV2Pair(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        uint256 supply = p.totalSupply();
        if (supply == 0) return 0;
        uint256 k = uint256(r0) * uint256(r1);
        return (_sqrt(k) * 1e18) / supply;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Power Plant WETH Drain
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Drain accumulated power plant WETH to the power plant address
    function drainToPowerPlant() external onlyOwner {
        require(powerPlant != address(0), "plant not set");
        uint256 amount = powerPlantBalance;
        require(amount > 0, "empty");
        powerPlantBalance = 0;
        IERC20(WETH).transfer(powerPlant, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Pending 💩 for a tokenId + pair
    function pendingPoop(uint256 tokenId, address pair) external view returns (uint256) {
        LPStake storage s = vaults[tokenId][pair];
        if (s.amount == 0) return 0;
        uint256 currentIndex = _currentFeeIndex(pair);
        uint256 lastIndex = s.lastFeeIndex;
        if (currentIndex <= lastIndex || lastIndex == 0) return 0;
        uint256 pairWethPerLP = pairs[pair].wethPerLP;
        if (pairWethPerLP == 0 || wethPerPoop == 0) return 0;
        uint256 feeGrowth = currentIndex - lastIndex;
        uint256 feeValueWETH = (feeGrowth * s.amount * pairWethPerLP) / (lastIndex * 1e18);
        return ((feeValueWETH * 1e18) / wethPerPoop + s.poopAccum) / 1e18 * 1e18;
    }

    /// @notice Total LP locked in a baseling's vault across all pairs
    function totalVaultLP(uint256 tokenId) external view returns (uint256 total) {
        address[] storage pList = vaultPairs[tokenId];
        for (uint256 i = 0; i < pList.length; i++) {
            total += vaults[tokenId][pList[i]].amount;
        }
    }

    /// @notice Total WETH value of a baseling's vault
    function totalVaultWETH(uint256 tokenId) external view returns (uint256 total) {
        address[] storage pList = vaultPairs[tokenId];
        for (uint256 i = 0; i < pList.length; i++) {
            address p = pList[i];
            total += (vaults[tokenId][p].amount * pairs[p].wethPerLP) / 1e18;
        }
    }

    function getVaultPairs(uint256 tokenId) external view returns (address[] memory) {
        return vaultPairs[tokenId];
    }

    function getPairCount() external view returns (uint256) { return pairList.length; }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════

    function addPair(address pair) external onlyOwner {
        require(!pairs[pair].accepted, "exists");
        pairs[pair] = PairConfig({ accepted: true, wethPerLP: 0 });
        pairList.push(pair);
    }

    function setPairWethPerLP(address pair, uint256 value) external onlyOwner {
        require(pairs[pair].accepted, "not accepted");
        pairs[pair].wethPerLP = value;
    }

    function setWethPerPoop(uint256 value) external onlyOwner {
        wethPerPoop = value;
    }

    function setPoopToken(address _poop) external onlyOwner {
        poop = IPoopToken(_poop);
    }

    function setPowerPlant(address _plant) external onlyOwner {
        powerPlant = _plant;
    }

    function setFamilyPair(uint8 family, address pair) external onlyOwner {
        require(family <= 2, "invalid");
        familyPairs[family] = pair;
    }

    function setEggPrices(uint256 _random, uint256 _sorted, uint256 _giant) external onlyOwner {
        randomEggPrice = _random;
        sortedEggPrice = _sorted;
        giantEggPrice = _giant;
    }

    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
    }

    // --- Metadata ---
    string public baseURI;

    function setBaseURI(string calldata _uri) external onlyOwner {
        baseURI = _uri;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(ownerOf[tokenId] != address(0), "nonexistent");
        return string(abi.encodePacked(baseURI, _toString(tokenId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Sqrt — Babylonian method
    // ═══════════════════════════════════════════════════════════════════════

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        return y;
    }
}
