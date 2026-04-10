// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// V4SwapperWETHMFT — Swap WETH <-> MfT through Uniswap V4 on Base
//
// Contract 1 of 4 in the Tales of Tasern vault system.
// Uses PoolManager.unlock() callback pattern for direct V4 swaps.
// ═══════════════════════════════════════════════════════════════════════════

// ── Minimal V4 Interfaces ────────────────────────────────────────────────

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified; // negative = exact input
        uint160 sqrtPriceLimitX96;
    }

    function unlock(bytes calldata data) external returns (bytes memory);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external returns (int256 balanceDelta);
    function sync(address token) external;
    function settle() external payable returns (uint256);
    function take(address token, address to, uint256 amount) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ── Contract ─────────────────────────────────────────────────────────────

contract V4SwapperWETHMFT {
    // Base mainnet addresses
    IPoolManager public constant POOL_MANAGER = IPoolManager(0x498581fF718922c3f8e6A244956aF099B2652b2b);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    // V4 pool key for WETH/MfT (Bankr Bot launch pool)
    PoolKey public poolKey;

    // V4 sqrt price limits (min+1 and max-1 to allow full range)
    uint160 private constant MIN_SQRT_PRICE_LIMIT = 4295128740;
    uint160 private constant MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    address public owner;

    event Swapped(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor() {
        owner = msg.sender;
        poolKey = PoolKey({
            currency0: WETH,
            currency1: MFT,
            fee: 8388608,        // dynamic fee (Bankr Bot hook)
            tickSpacing: int24(200),
            hooks: 0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0
        });
    }

    // ── Swap WETH → MfT ──────────────────────────────────────────────────
    /// @param amountIn  Amount of WETH to swap
    /// @param minOut    Minimum MfT to receive (slippage protection)
    function swapWETHforMFT(uint256 amountIn, uint256 minOut) external {
        require(amountIn > 0, "zero amount");
        IERC20(WETH).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(
            abi.encode(true, amountIn, minOut, msg.sender)
        );
        uint256 amountOut = abi.decode(result, (uint256));
        emit Swapped(msg.sender, WETH, amountIn, amountOut);
    }

    // ── Swap MfT → WETH ──────────────────────────────────────────────────
    /// @param amountIn  Amount of MfT to swap
    /// @param minOut    Minimum WETH to receive (slippage protection)
    function swapMFTforWETH(uint256 amountIn, uint256 minOut) external {
        require(amountIn > 0, "zero amount");
        IERC20(MFT).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(
            abi.encode(false, amountIn, minOut, msg.sender)
        );
        uint256 amountOut = abi.decode(result, (uint256));
        emit Swapped(msg.sender, MFT, amountIn, amountOut);
    }

    // ── V4 Callback ──────────────────────────────────────────────────────
    /// Called by PoolManager during unlock(). Executes the swap and settles.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(POOL_MANAGER), "only PM");

        (bool zeroForOne, uint256 amountIn, uint256 minOut, address recipient) =
            abi.decode(data, (bool, uint256, uint256, address));

        address inputToken  = zeroForOne ? WETH : MFT;
        address outputToken = zeroForOne ? MFT  : WETH;

        // Execute swap — negative amountSpecified = exact input
        int256 delta = POOL_MANAGER.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT
            }),
            bytes("")
        );

        // Decode BalanceDelta (packed int128, int128)
        int128 delta0 = int128(delta >> 128);
        int128 delta1 = int128(delta);

        // Output amount (the positive delta is what we receive)
        uint256 amountOut;
        if (zeroForOne) {
            // Swapping token0→token1: delta1 is positive (output)
            require(delta1 > 0, "bad swap");
            amountOut = uint256(uint128(delta1));
        } else {
            // Swapping token1→token0: delta0 is positive (output)
            require(delta0 > 0, "bad swap");
            amountOut = uint256(uint128(delta0));
        }
        require(amountOut >= minOut, "slippage");

        // Settle input: send tokens to PoolManager, then tell it to settle
        IERC20(inputToken).transfer(address(POOL_MANAGER), amountIn);
        POOL_MANAGER.settle();

        // Take output: PoolManager sends output tokens to recipient
        POOL_MANAGER.take(outputToken, recipient, amountOut);

        return abi.encode(amountOut);
    }

    // ── Rescue stuck tokens (owner only) ─────────────────────────────────
    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}
