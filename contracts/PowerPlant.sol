// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PowerPlant — POOP burn engine + LP management
 *
 * Two categories of pools:
 *   1. Volatility pools (WETH/POOP, BTC/POOP, AZUSD/POOP)
 *      — Outside market volatility burns POOP
 *      — POOP fees → burned, WETH fees → 50% buy+burn POOP / 50% expand LP
 *
 *   2. Spoiled food pool (POOP/MfT)
 *      — Spoiled food (token/MfT LP) → unwound → converted to POOP/MfT LP
 *      — MfT exception: forever-locked, no sell pressure on MfT
 *
 * Funded by:
 *   - Infrastructure purchases (houses, rooms, upgrades) → WETH
 *   - Spoiled food from PlayerPantry → token/MfT LP
 *   - Garden plot purchases → WETH
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPoopToken {
    function burnFrom(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
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
    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 liquidity, uint256 amountAMin, uint256 amountBMin,
        address to, uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

// ═══════════════════════════════════════════════════════════════════════════

contract PowerPlant {

    address public owner;
    address public keeper;  // authorized to call processFees

    // Known tokens
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public poopToken;

    // V2 router for swaps + LP
    IUniswapV2Router public v2Router;

    // Authorized senders (BaselingNFT, PlayerPantry, GardenNFT)
    mapping(address => bool) public authorized;

    // --- Volatility Pools (token/POOP pairs we manage) ---
    struct VolatilityPool {
        address token;      // WETH, BTC, AZUSD
        address pair;       // LP pair address
        uint256 lpHeld;     // LP tokens we control
        bool active;
    }
    mapping(uint8 => VolatilityPool) public volatilityPools;
    uint8 public volatilityPoolCount;

    // --- POOP/MfT forever-locked LP (from spoiled food) ---
    address public poopMftPair;     // POOP/MfT LP pair address
    uint256 public poopMftLocked;   // total POOP/MfT LP forever-locked

    // --- Stats ---
    uint256 public totalPoopBurned;
    uint256 public totalWETHReceived;
    uint256 public totalSpoiledReceived;

    // --- Events ---
    event InfraPayment(address indexed from, uint256 wethAmount);
    event SpoiledFoodReceived(address indexed pair, uint256 lpAmount);
    event PoopBurned(uint256 amount, string source);
    event LPExpanded(uint8 indexed poolId, uint256 lpAdded);
    event PoopMftLocked(uint256 lpAmount);

    // --- Modifiers ---
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyAuthorized() { require(authorized[msg.sender] || msg.sender == owner, "not authorized"); _; }
    modifier onlyKeeper() { require(msg.sender == keeper || msg.sender == owner, "not keeper"); _; }

    // ═══════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _poop, address _v2Router) {
        owner = msg.sender;
        keeper = msg.sender;
        poopToken = _poop;
        v2Router = IUniswapV2Router(_v2Router);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Receive WETH — from infrastructure purchases
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Receive WETH from infrastructure (houses, rooms, upgrades, garden plots)
    /// Called by BaselingNFT.drainToPowerPlant() or directly by authorized contracts
    function receiveWETH(uint256 amount) external onlyAuthorized {
        IERC20(WETH).transferFrom(msg.sender, address(this), amount);
        totalWETHReceived += amount;
        emit InfraPayment(msg.sender, amount);
    }

    /// @notice Accept WETH transfers directly (from drainToPowerPlant etc)
    /// The WETH just accumulates until processFees is called
    function receiveWETHDirect() external {
        // just accept — WETH already transferred to this address
        uint256 bal = IERC20(WETH).balanceOf(address(this));
        if (bal > totalWETHReceived) {
            totalWETHReceived = bal; // sync
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Receive Spoiled Food — from PlayerPantry
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Spoiled food LP arrives from PlayerPantry
    /// Will be unwound and converted to POOP/MfT LP on next processFees call
    function receiveSpoiledFood(address pair, uint256 amount) external onlyAuthorized {
        // LP already transferred to this contract by PlayerPantry
        totalSpoiledReceived += amount;
        emit SpoiledFoodReceived(pair, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Process Fees — Keeper calls periodically
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Process accumulated WETH: buy POOP and burn or expand LP
    /// Keeper calls this periodically (daily or more)
    function processWETH(uint256 wethAmount) external onlyKeeper {
        require(wethAmount > 0, "zero");
        uint256 bal = IERC20(WETH).balanceOf(address(this));
        require(bal >= wethAmount, "insufficient WETH");

        // 50% buy POOP → burn
        uint256 halfBuy = wethAmount / 2;
        // 50% expand volatility LP (added later when pool setup is complete)
        uint256 halfExpand = wethAmount - halfBuy;

        if (halfBuy > 0 && poopToken != address(0)) {
            _buyAndBurnPoop(halfBuy);
        }

        // For now, hold the expand portion — will be paired with POOP when pools active
        // Future: add to specific volatility pool LP
        // WETH stays in contract for now
        if (halfExpand > 0) {
            // placeholder — expansion logic per volatility pool
        }
    }

    /// @notice Buy POOP with WETH via V2 and burn it
    function _buyAndBurnPoop(uint256 wethAmount) internal {
        IERC20(WETH).approve(address(v2Router), wethAmount);

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = MFT;

        // WETH → MfT first (since POOP pairs against MfT too)
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            wethAmount, 0, path, address(this), block.timestamp
        );

        // Then MfT → POOP if POOP/MfT pair exists
        uint256 mftAmount = amounts[amounts.length - 1];
        if (mftAmount > 0 && poopToken != address(0)) {
            address[] memory path2 = new address[](2);
            path2[0] = MFT;
            path2[1] = poopToken;

            IERC20(MFT).approve(address(v2Router), mftAmount);
            uint256[] memory amounts2 = v2Router.swapExactTokensForTokens(
                mftAmount, 0, path2, address(this), block.timestamp
            );

            uint256 poopBought = amounts2[amounts2.length - 1];
            if (poopBought > 0) {
                // Burn the POOP
                IERC20(poopToken).approve(poopToken, poopBought);
                IPoopToken(poopToken).burnFrom(address(this), poopBought);
                totalPoopBurned += poopBought;
                emit PoopBurned(poopBought, "weth-buyback");
            }
        }
    }

    /// @notice Convert spoiled food LP (token/MfT) → POOP/MfT LP (forever-locked)
    /// @param foodPair The spoiled food LP pair address
    /// @param foodToken The non-MfT token in the food pair
    /// @param lpAmount Amount of food LP to unwind
    function convertSpoiledFood(
        address foodPair,
        address foodToken,
        uint256 lpAmount
    ) external onlyKeeper {
        require(lpAmount > 0, "zero");
        require(poopMftPair != address(0), "poop/mft pair not set");

        // 1. Remove liquidity from food pair → get foodToken + MfT
        IERC20(foodPair).approve(address(v2Router), lpAmount);
        (uint256 tokenOut, uint256 mftOut) = v2Router.removeLiquidity(
            foodToken, MFT, lpAmount, 0, 0, address(this), block.timestamp
        );

        // 2. Swap foodToken → MfT (all of it)
        if (tokenOut > 0) {
            IERC20(foodToken).approve(address(v2Router), tokenOut);
            address[] memory path = new address[](2);
            path[0] = foodToken;
            path[1] = MFT;
            uint256[] memory amounts = v2Router.swapExactTokensForTokens(
                tokenOut, 0, path, address(this), block.timestamp
            );
            mftOut += amounts[amounts.length - 1];
        }

        // 3. Swap half MfT → POOP
        uint256 halfMft = mftOut / 2;
        IERC20(MFT).approve(address(v2Router), mftOut);
        address[] memory path2 = new address[](2);
        path2[0] = MFT;
        path2[1] = poopToken;
        uint256[] memory poopAmounts = v2Router.swapExactTokensForTokens(
            halfMft, 0, path2, address(this), block.timestamp
        );
        uint256 poopAmount = poopAmounts[poopAmounts.length - 1];

        // 4. Add POOP + MfT as LP → forever-locked in this contract
        uint256 remainingMft = IERC20(MFT).balanceOf(address(this));
        IERC20(poopToken).approve(address(v2Router), poopAmount);
        IERC20(MFT).approve(address(v2Router), remainingMft);
        (,, uint256 liq) = v2Router.addLiquidity(
            poopToken, MFT, poopAmount, remainingMft,
            0, 0, address(this), block.timestamp
        );

        poopMftLocked += liq;
        emit PoopMftLocked(liq);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Volatility Pool Management
    // ═══════════════════════════════════════════════════════════════════════

    function addVolatilityPool(address token, address pair) external onlyOwner {
        uint8 id = volatilityPoolCount++;
        volatilityPools[id] = VolatilityPool({
            token: token,
            pair: pair,
            lpHeld: 0,
            active: true
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Views
    // ═══════════════════════════════════════════════════════════════════════

    function totalWETHHeld() external view returns (uint256) {
        return IERC20(WETH).balanceOf(address(this));
    }

    function totalMfTHeld() external view returns (uint256) {
        return IERC20(MFT).balanceOf(address(this));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════════════════════════════════════════════════════════════

    function setPoopToken(address _poop) external onlyOwner { poopToken = _poop; }
    function setPoopMftPair(address _pair) external onlyOwner { poopMftPair = _pair; }
    function setV2Router(address _router) external onlyOwner { v2Router = IUniswapV2Router(_router); }
    function setKeeper(address _keeper) external onlyOwner { keeper = _keeper; }
    function setAuthorized(address account, bool status) external onlyOwner { authorized[account] = status; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }

    function rescue(address token) external onlyOwner {
        // Cannot rescue POOP/MfT LP — that's forever-locked
        require(token != poopMftPair, "cannot rescue locked LP");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}
