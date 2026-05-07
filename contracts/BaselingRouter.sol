// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * BaselingRouter — One-click routing for Baseling game actions
 *
 * Handles the MfT-hub routing:
 *   WETH → MfT (V4 pool) → half MfT → target token (V2) → token/MfT LP → destination
 *
 * Two main flows:
 *   1. Buy egg:  WETH → MfT → token/MfT LP → BaselingNFT vault (locked forever)
 *   2. Buy food: WETH → MfT → token/MfT LP → PlayerPantry cupboard
 *
 * Adapts the GenericVaultRouter pattern from VaultSystem.sol.
 */

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IV4Swapper {
    function swapWETHforMFTTo(uint256 amountIn, uint256 minOut, address to) external returns (uint256);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path,
        address to, uint256 deadline
    ) external returns (uint256[] memory amounts);
    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}

interface IBaselingNFT {
    function claimSeed(uint256 tokenId) external returns (uint256);
    function deposit(uint256 tokenId, address pair, uint256 amount) external;
    function baselings(uint256 tokenId) external view returns (uint8, uint8, bool, uint64, uint64, uint32, uint16);
    function familyPairs(uint256 family) external view returns (address);
}

interface IPlayerPantry {
    function depositToCupboard(address player, address pair, uint256 amount) external;
    function depositToFreezer(address player, address pair, uint256 amount) external;
}

// ═══════════════════════════════════════════════════════════════════════════

contract BaselingRouter {

    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    // Family tokens: 0=TGN, 1=BURGERS, 2=AZUSD
    address[3] public familyTokens;

    // Family LP pairs: token/MfT pairs
    address[3] public familyLPPairs;

    IV4Swapper public v4Swapper;
    IUniswapV2Router public v2Router;
    IBaselingNFT public baselingNFT;
    IPlayerPantry public pantry;

    address public owner;

    event EggSeeded(uint256 indexed tokenId, uint8 family, uint256 wethIn, uint256 lpOut);
    event FoodBought(address indexed player, address indexed pair, uint256 wethIn, uint256 lpOut, bool toFreezer);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(
        address _v4Swapper,
        address _v2Router,
        address _baselingNFT,
        address _pantry
    ) {
        owner = msg.sender;
        v4Swapper = IV4Swapper(_v4Swapper);
        v2Router = IUniswapV2Router(_v2Router);
        baselingNFT = IBaselingNFT(_baselingNFT);
        pantry = IPlayerPantry(_pantry);

        // Default family tokens (Base mainnet)
        familyTokens[0] = 0xD75dfa972C6136f1c594Fec1945302f885E1ab29; // TGN
        familyTokens[1] = 0x06A05043eb2C1691b19c2C13219dB9212269dDc5; // BURGERS
        familyTokens[2] = 0x3595ca37596D5895B70EFAB592ac315D5B9809B2; // AZUSD
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Convert Egg Seed — WETH → MfT → token/MfT LP → baseling vault
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Convert an egg's WETH seed to LP and deposit in its vault
    /// Called after minting (can be batched by keeper or piggybacked)
    function convertSeed(uint256 tokenId) external {
        // 1. Claim WETH seed from BaselingNFT
        uint256 wethAmount = baselingNFT.claimSeed(tokenId);
        require(wethAmount > 0, "no seed");

        // 2. Get family from baseling
        (, uint8 family,,,,,) = baselingNFT.baselings(tokenId);
        address token = familyTokens[family];
        address lpPair = familyLPPairs[family];
        require(lpPair != address(0), "pair not set");

        // 3. Route: WETH → MfT → token/MfT LP
        uint256 lpAmount = _createLP(wethAmount, token, lpPair);

        // 4. Deposit LP to baseling vault (locked forever)
        IERC20(lpPair).approve(address(baselingNFT), lpAmount);
        baselingNFT.deposit(tokenId, lpPair, lpAmount);

        emit EggSeeded(tokenId, family, wethAmount, lpAmount);
    }

    /// @notice Batch convert multiple egg seeds
    function convertSeedBatch(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Try each — skip failures (already converted, no seed, etc.)
            try this.convertSeed(tokenIds[i]) {} catch {}
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Buy Food — WETH → MfT → token/MfT LP → PlayerPantry cupboard
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Buy food (create LP from WETH and deposit to player's cupboard)
    /// @param family Which food: 0=salad(TGN), 1=burger(BURGERS), 2=rice(AZUSD)
    /// @param wethAmount Amount of WETH to spend on food
    function buyFood(uint8 family, uint256 wethAmount) external {
        require(family <= 2, "invalid food");
        require(wethAmount > 0, "zero");

        address token = familyTokens[family];
        address lpPair = familyLPPairs[family];
        require(lpPair != address(0), "pair not set");

        // Pull WETH from player
        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);

        // Route: WETH → MfT → token/MfT LP
        uint256 lpAmount = _createLP(wethAmount, token, lpPair);

        // Deposit LP to player's cupboard (timer resets)
        IERC20(lpPair).approve(address(pantry), lpAmount);
        pantry.depositToCupboard(msg.sender, lpPair, lpAmount);

        // Return any dust
        _returnDust(msg.sender, token, lpPair);

        emit FoodBought(msg.sender, lpPair, wethAmount, lpAmount, false);
    }

    /// @notice Buy food and put directly in freezer
    function buyFoodToFreezer(uint8 family, uint256 wethAmount) external {
        require(family <= 2, "invalid food");
        require(wethAmount > 0, "zero");

        address token = familyTokens[family];
        address lpPair = familyLPPairs[family];
        require(lpPair != address(0), "pair not set");

        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);

        uint256 lpAmount = _createLP(wethAmount, token, lpPair);

        IERC20(lpPair).approve(address(pantry), lpAmount);
        pantry.depositToFreezer(msg.sender, lpPair, lpAmount);

        _returnDust(msg.sender, token, lpPair);

        emit FoodBought(msg.sender, lpPair, wethAmount, lpAmount, true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Internal — WETH → MfT → token/MfT LP
    // ═══════════════════════════════════════════════════════════════════════

    function _createLP(uint256 wethAmount, address token, address lpPair) internal returns (uint256 lpAmount) {
        // 1. WETH → MfT via V4
        IERC20(WETH).approve(address(v4Swapper), wethAmount);
        uint256 mftTotal = v4Swapper.swapWETHforMFTTo(wethAmount, 0, address(this));

        // 2. Half MfT → target token via V2
        uint256 halfMft = mftTotal / 2;
        IERC20(MFT).approve(address(v2Router), mftTotal); // approve full for addLiq too
        address[] memory path = new address[](2);
        path[0] = MFT;
        path[1] = token;
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            halfMft, 0, path, address(this), block.timestamp
        );
        uint256 tokenAmt = amounts[amounts.length - 1];

        // 3. token + MfT → LP
        uint256 remainingMft = IERC20(MFT).balanceOf(address(this));
        IERC20(token).approve(address(v2Router), tokenAmt);
        IERC20(MFT).approve(address(v2Router), remainingMft);
        (,, lpAmount) = v2Router.addLiquidity(
            token, MFT, tokenAmt, remainingMft,
            0, 0, address(this), block.timestamp
        );
    }

    function _returnDust(address to, address token, address lpPair) internal {
        uint256 t = IERC20(token).balanceOf(address(this));
        uint256 m = IERC20(MFT).balanceOf(address(this));
        uint256 w = IERC20(WETH).balanceOf(address(this));
        uint256 l = IERC20(lpPair).balanceOf(address(this));
        if (t > 0) IERC20(token).transfer(to, t);
        if (m > 0) IERC20(MFT).transfer(to, m);
        if (w > 0) IERC20(WETH).transfer(to, w);
        if (l > 0) IERC20(lpPair).transfer(to, l);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════

    function setFamilyToken(uint8 family, address token) external onlyOwner {
        require(family <= 2, "invalid");
        familyTokens[family] = token;
    }

    function setFamilyLPPair(uint8 family, address pair) external onlyOwner {
        require(family <= 2, "invalid");
        familyLPPairs[family] = pair;
    }

    function setV4Swapper(address _v4) external onlyOwner { v4Swapper = IV4Swapper(_v4); }
    function setV2Router(address _v2) external onlyOwner { v2Router = IUniswapV2Router(_v2); }
    function setBaselingNFT(address _nft) external onlyOwner { baselingNFT = IBaselingNFT(_nft); }
    function setPantry(address _pantry) external onlyOwner { pantry = IPlayerPantry(_pantry); }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }

    function rescue(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}
