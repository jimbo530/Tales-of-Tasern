// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// Tales of Tasern — Vault System (Base Chain)
//
// 5 contracts that chain together:
//   1. V4Swapper    — WETH <-> MfT via Uniswap V4
//   2. V2Swapper    — MfT <-> BURGERS via Uniswap V2
//   3. LPManager    — BURGERS + MfT <-> LP token via V2 Router
//   4. Vault        — LP deposit/withdraw with 10% community split
//   5. VaultRouter  — One-click WETH -> LP vault (and reverse)
//
// Mountain Ork NFT: 0xCd43D8eB17736bFDBd8862B7E03b6B5a4ad476A2
// BURGERS/MfT LP:   0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared Interfaces ────────────────────────────────────────────────────

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
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
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);
}

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
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
    function unlock(bytes calldata data) external returns (bytes memory);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external returns (int256 balanceDelta);
    function sync(address currency) external;
    function settle() external payable returns (uint256);
    function take(address token, address to, uint256 amount) external;
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 1: V4 Swapper — WETH <-> MfT
// ═══════════════════════════════════════════════════════════════════════════

contract V4Swapper {
    IPoolManager public constant POOL_MANAGER = IPoolManager(0x498581fF718922c3f8e6A244956aF099B2652b2b);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    PoolKey public poolKey;
    address public owner;

    uint160 private constant MIN_SQRT = 4295128740;
    uint160 private constant MAX_SQRT = 1461446703485210103287273052203988822378723970341;

    event Swapped(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor() {
        owner = msg.sender;
        poolKey = PoolKey({
            currency0: WETH,
            currency1: MFT,
            fee: 8388608,
            tickSpacing: int24(200),
            hooks: 0xbB7784A4d481184283Ed89619A3e3ed143e1Adc0
        });
    }

    function swapWETHforMFT(uint256 amountIn, uint256 minOut) external returns (uint256) {
        require(amountIn > 0, "zero");
        IERC20(WETH).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(abi.encode(true, amountIn, minOut, msg.sender));
        uint256 amountOut = abi.decode(result, (uint256));
        emit Swapped(msg.sender, WETH, amountIn, amountOut);
        return amountOut;
    }

    function swapMFTforWETH(uint256 amountIn, uint256 minOut) external returns (uint256) {
        require(amountIn > 0, "zero");
        IERC20(MFT).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(abi.encode(false, amountIn, minOut, msg.sender));
        uint256 amountOut = abi.decode(result, (uint256));
        emit Swapped(msg.sender, MFT, amountIn, amountOut);
        return amountOut;
    }

    /// @notice Swap and send output to a specific address (for router use)
    function swapWETHforMFTTo(uint256 amountIn, uint256 minOut, address to) external returns (uint256) {
        require(amountIn > 0, "zero");
        IERC20(WETH).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(abi.encode(true, amountIn, minOut, to));
        return abi.decode(result, (uint256));
    }

    function swapMFTforWETHTo(uint256 amountIn, uint256 minOut, address to) external returns (uint256) {
        require(amountIn > 0, "zero");
        IERC20(MFT).transferFrom(msg.sender, address(this), amountIn);
        bytes memory result = POOL_MANAGER.unlock(abi.encode(false, amountIn, minOut, to));
        return abi.decode(result, (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(POOL_MANAGER), "only PM");
        (bool zeroForOne, uint256 amountIn, uint256 minOut, address recipient) =
            abi.decode(data, (bool, uint256, uint256, address));

        address inputToken  = zeroForOne ? WETH : MFT;
        address outputToken = zeroForOne ? MFT  : WETH;

        int256 delta = POOL_MANAGER.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT : MAX_SQRT
            }),
            bytes("")
        );

        int128 delta0 = int128(delta >> 128);
        int128 delta1 = int128(delta);

        // V4 convention: negative delta = pay (settle), positive delta = receive (take)
        uint256 amountOut;
        if (zeroForOne) {
            require(delta1 > 0, "bad swap");
            amountOut = uint256(uint128(delta1));
        } else {
            require(delta0 > 0, "bad swap");
            amountOut = uint256(uint128(delta0));
        }
        require(amountOut >= minOut, "slippage");

        // Settle input: sync -> transfer -> settle (required for ERC20 in V4)
        POOL_MANAGER.sync(inputToken);
        IERC20(inputToken).transfer(address(POOL_MANAGER), amountIn);
        POOL_MANAGER.settle();

        // Take output
        POOL_MANAGER.take(outputToken, recipient, amountOut);

        return abi.encode(amountOut);
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 2: V2 Swapper — MfT <-> BURGERS
// ═══════════════════════════════════════════════════════════════════════════

contract V2Swapper {
    IUniswapV2Router public constant V2_ROUTER = IUniswapV2Router(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant MFT     = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public constant BURGERS = 0x06A05043eb2C1691b19c2C13219dB9212269dDc5;
    address public owner;

    constructor() { owner = msg.sender; }

    function swapMFTforBURGERS(uint256 amountIn, uint256 minOut, address to) external returns (uint256) {
        IERC20(MFT).transferFrom(msg.sender, address(this), amountIn);
        IERC20(MFT).approve(address(V2_ROUTER), amountIn);
        address[] memory path = new address[](2);
        path[0] = MFT;
        path[1] = BURGERS;
        uint256[] memory amounts = V2_ROUTER.swapExactTokensForTokens(
            amountIn, minOut, path, to, block.timestamp + 300
        );
        return amounts[amounts.length - 1];
    }

    function swapBURGERSforMFT(uint256 amountIn, uint256 minOut, address to) external returns (uint256) {
        IERC20(BURGERS).transferFrom(msg.sender, address(this), amountIn);
        IERC20(BURGERS).approve(address(V2_ROUTER), amountIn);
        address[] memory path = new address[](2);
        path[0] = BURGERS;
        path[1] = MFT;
        uint256[] memory amounts = V2_ROUTER.swapExactTokensForTokens(
            amountIn, minOut, path, to, block.timestamp + 300
        );
        return amounts[amounts.length - 1];
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 3: LP Manager — BURGERS + MfT <-> LP token
// ═══════════════════════════════════════════════════════════════════════════

contract LPManager {
    IUniswapV2Router public constant V2_ROUTER = IUniswapV2Router(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant MFT     = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public constant BURGERS = 0x06A05043eb2C1691b19c2C13219dB9212269dDc5;
    address public constant LP_PAIR = 0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288;
    address public owner;

    constructor() { owner = msg.sender; }

    /// @notice Add liquidity. Caller must have approved this contract for both tokens.
    ///         LP tokens sent to `to`. Returns (amountA, amountB, liquidity).
    function addLiq(uint256 amountBurgers, uint256 amountMft, uint256 minBurgers, uint256 minMft, address to)
        external returns (uint256, uint256, uint256)
    {
        IERC20(BURGERS).transferFrom(msg.sender, address(this), amountBurgers);
        IERC20(MFT).transferFrom(msg.sender, address(this), amountMft);
        IERC20(BURGERS).approve(address(V2_ROUTER), amountBurgers);
        IERC20(MFT).approve(address(V2_ROUTER), amountMft);

        (uint256 a, uint256 b, uint256 liq) = V2_ROUTER.addLiquidity(
            BURGERS, MFT, amountBurgers, amountMft,
            minBurgers, minMft, to, block.timestamp + 300
        );

        // Return leftover tokens to caller
        uint256 leftBurgers = IERC20(BURGERS).balanceOf(address(this));
        uint256 leftMft = IERC20(MFT).balanceOf(address(this));
        if (leftBurgers > 0) IERC20(BURGERS).transfer(msg.sender, leftBurgers);
        if (leftMft > 0) IERC20(MFT).transfer(msg.sender, leftMft);

        return (a, b, liq);
    }

    /// @notice Remove liquidity. Caller must have approved this contract for LP tokens.
    ///         Returns BURGERS and MfT to `to`.
    function removeLiq(uint256 lpAmount, uint256 minBurgers, uint256 minMft, address to)
        external returns (uint256, uint256)
    {
        IERC20(LP_PAIR).transferFrom(msg.sender, address(this), lpAmount);
        IERC20(LP_PAIR).approve(address(V2_ROUTER), lpAmount);
        return V2_ROUTER.removeLiquidity(
            BURGERS, MFT, lpAmount, minBurgers, minMft, to, block.timestamp + 300
        );
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 4: Vault — LP deposit/withdraw with 10% community split
// ═══════════════════════════════════════════════════════════════════════════

contract OrkVault {
    address public constant LP_PAIR  = 0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288;
    address public constant ORK_NFT  = 0xCd43D8eB17736bFDBd8862B7E03b6B5a4ad476A2;
    uint256 public constant COMMUNITY_BPS = 1000; // 10% = 1000 basis points

    address public owner;
    uint256 public communityPool;  // total LP locked for community
    mapping(address => bool) public authorizedRouter;

    // tokenId => user => staked LP amount
    mapping(uint256 => mapping(address => uint256)) public userStake;
    // tokenId => total staked by all users
    mapping(uint256 => uint256) public tokenStake;
    // total staked across all tokens (excluding community)
    uint256 public totalStaked;

    event Deposited(address indexed user, uint256 indexed tokenId, uint256 userAmount, uint256 communityAmount);
    event Withdrawn(address indexed user, uint256 indexed tokenId, uint256 amount);

    constructor() { owner = msg.sender; }

    function setRouter(address router, bool allowed) external {
        require(msg.sender == owner, "not owner");
        authorizedRouter[router] = allowed;
    }

    /// @notice Deposit LP for a specific Ork token ID. 10% goes to community pool.
    function deposit(uint256 tokenId, uint256 amount) external {
        _deposit(tokenId, amount, msg.sender);
    }

    /// @notice Deposit LP on behalf of a user (only authorized routers)
    function depositFor(uint256 tokenId, uint256 amount, address user) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _deposit(tokenId, amount, user);
    }

    function _deposit(uint256 tokenId, uint256 amount, address user) internal {
        require(amount > 0, "zero");
        require(IERC1155(ORK_NFT).balanceOf(user, tokenId) > 0, "not ork owner");
        IERC20(LP_PAIR).transferFrom(msg.sender, address(this), amount);

        uint256 communityShare = (amount * COMMUNITY_BPS) / 10000;
        uint256 userShare = amount - communityShare;

        // Send community share to NFT contract (locked forever)
        IERC20(LP_PAIR).transfer(ORK_NFT, communityShare);
        communityPool += communityShare;

        userStake[tokenId][user] += userShare;
        tokenStake[tokenId] += userShare;
        totalStaked += userShare;

        emit Deposited(user, tokenId, userShare, communityShare);
    }

    /// @notice Withdraw LP from a specific token ID
    function withdraw(uint256 tokenId, uint256 amount) external {
        _withdraw(tokenId, amount, msg.sender, msg.sender);
    }

    /// @notice Withdraw LP on behalf of a user (only authorized routers)
    function withdrawFor(uint256 tokenId, uint256 amount, address user, address to) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _withdraw(tokenId, amount, user, to);
    }

    function _withdraw(uint256 tokenId, uint256 amount, address user, address to) internal {
        require(amount > 0, "zero");
        require(IERC1155(ORK_NFT).balanceOf(user, tokenId) > 0, "not ork owner");
        require(userStake[tokenId][user] >= amount, "insufficient");

        userStake[tokenId][user] -= amount;
        tokenStake[tokenId] -= amount;
        totalStaked -= amount;

        IERC20(LP_PAIR).transfer(to, amount);
        emit Withdrawn(user, tokenId, amount);
    }

    /// @notice View: total LP backing a token (personal stakes + community share)
    function totalBacking(uint256 tokenId, uint256 totalTokens) external view returns (uint256) {
        uint256 communityShare = totalTokens > 0 ? communityPool / totalTokens : 0;
        return tokenStake[tokenId] + communityShare;
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        require(token != LP_PAIR, "cannot rescue LP");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 4b: PowerVault — Generic vault for ANY ERC1155 collection
// ═══════════════════════════════════════════════════════════════════════════

contract PowerVault {
    address public immutable LP_PAIR;
    address public immutable NFT;
    address public immutable COMMUNITY_RECIPIENT;
    uint256 public immutable FEE_BPS; // total fee (e.g. 100 = 1%)

    address public owner;
    uint256 public communityPool;  // total LP sent to NFT CA
    uint256 public totalLocked;    // total LP forever-locked across all tokens
    mapping(address => bool) public authorizedRouter;

    mapping(uint256 => mapping(address => uint256)) public userStake;
    mapping(uint256 => mapping(address => uint256)) public totalDeposited; // cumulative LP in (before fees)
    mapping(uint256 => uint256) public tokenStake;
    mapping(uint256 => uint256) public lockedStake; // forever-locked LP per tokenId
    uint256 public totalStaked;

    event Deposited(address indexed user, uint256 indexed tokenId, uint256 rawAmount, uint256 userAmount, uint256 communityAmount, uint256 lockedAmount);
    event Withdrawn(address indexed user, uint256 indexed tokenId, uint256 amount);

    constructor(address _lpPair, address _nft, address _communityRecipient, uint256 _feeBps) {
        require(_feeBps <= 5000, "max 50%");
        LP_PAIR = _lpPair;
        NFT = _nft;
        COMMUNITY_RECIPIENT = _communityRecipient;
        FEE_BPS = _feeBps;
        owner = msg.sender;
    }

    function setRouter(address router, bool allowed) external {
        require(msg.sender == owner, "not owner");
        authorizedRouter[router] = allowed;
    }

    function deposit(uint256 tokenId, uint256 amount) external {
        _deposit(tokenId, amount, msg.sender);
    }

    function depositFor(uint256 tokenId, uint256 amount, address user) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _deposit(tokenId, amount, user);
    }

    function _deposit(uint256 tokenId, uint256 amount, address user) internal {
        require(amount > 0, "zero");
        require(IERC1155(NFT).balanceOf(user, tokenId) > 0, "not nft owner");
        IERC20(LP_PAIR).transferFrom(msg.sender, address(this), amount);

        uint256 totalFee = (amount * FEE_BPS) / 10000;
        uint256 communityShare = totalFee / 2;       // half to NFT CA
        uint256 lockedShare = totalFee - communityShare; // half forever-locked in vault
        uint256 userShare = amount - totalFee;

        // Send community half to NFT contract
        if (communityShare > 0) {
            IERC20(LP_PAIR).transfer(COMMUNITY_RECIPIENT, communityShare);
            communityPool += communityShare;
        }

        // Lock the other half in the vault forever (per tokenId)
        lockedStake[tokenId] += lockedShare;
        totalLocked += lockedShare;

        // Track cumulative deposits (before fees) for entry-value calculation
        totalDeposited[tokenId][user] += amount;

        userStake[tokenId][user] += userShare;
        tokenStake[tokenId] += userShare;
        totalStaked += userShare;

        emit Deposited(user, tokenId, amount, userShare, communityShare, lockedShare);
    }

    function withdraw(uint256 tokenId, uint256 amount) external {
        _withdraw(tokenId, amount, msg.sender, msg.sender);
    }

    function withdrawFor(uint256 tokenId, uint256 amount, address user, address to) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _withdraw(tokenId, amount, user, to);
    }

    function _withdraw(uint256 tokenId, uint256 amount, address user, address to) internal {
        require(amount > 0, "zero");
        require(IERC1155(NFT).balanceOf(user, tokenId) > 0, "not nft owner");
        require(userStake[tokenId][user] >= amount, "insufficient");

        userStake[tokenId][user] -= amount;
        tokenStake[tokenId] -= amount;
        totalStaked -= amount;

        IERC20(LP_PAIR).transfer(to, amount);
        emit Withdrawn(user, tokenId, amount);
    }

    /// @notice Total LP backing a token: user stakes + forever-locked
    function totalBacking(uint256 tokenId) external view returns (uint256) {
        return tokenStake[tokenId] + lockedStake[tokenId];
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        require(token != LP_PAIR, "cannot rescue LP");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 4c: CrossChainVault — Vault for NFTs on other chains (e.g. Polygon)
//   Owner manages tokenId => wallet mapping instead of on-chain balanceOf
// ═══════════════════════════════════════════════════════════════════════════

contract CrossChainVault {
    address public immutable LP_PAIR;
    address public immutable NFT_REF;           // reference NFT address (on other chain)
    address public immutable COMMUNITY_RECIPIENT;
    uint256 public immutable FEE_BPS;

    address public owner;
    uint256 public communityPool;
    uint256 public totalLocked;
    mapping(address => bool) public authorizedRouter;

    // Owner-managed: who owns each tokenId (mirrors other-chain NFT ownership)
    mapping(uint256 => address) public tokenOwner;

    mapping(uint256 => mapping(address => uint256)) public userStake;
    mapping(uint256 => mapping(address => uint256)) public totalDeposited;
    mapping(uint256 => uint256) public tokenStake;
    mapping(uint256 => uint256) public lockedStake;
    uint256 public totalStaked;

    event OwnerSet(uint256 indexed tokenId, address indexed wallet);
    event OwnersBatchSet(uint256[] tokenIds, address[] wallets);
    event Deposited(address indexed user, uint256 indexed tokenId, uint256 rawAmount, uint256 userAmount, uint256 communityAmount, uint256 lockedAmount);
    event Withdrawn(address indexed user, uint256 indexed tokenId, uint256 amount);

    constructor(address _lpPair, address _nftRef, address _communityRecipient, uint256 _feeBps) {
        require(_feeBps <= 5000, "max 50%");
        LP_PAIR = _lpPair;
        NFT_REF = _nftRef;
        COMMUNITY_RECIPIENT = _communityRecipient;
        FEE_BPS = _feeBps;
        owner = msg.sender;
    }

    // ── Owner functions: sync NFT ownership from other chain ──

    function setTokenOwner(uint256 tokenId, address wallet) external {
        require(msg.sender == owner, "not owner");
        tokenOwner[tokenId] = wallet;
        emit OwnerSet(tokenId, wallet);
    }

    function setTokenOwnersBatch(uint256[] calldata tokenIds, address[] calldata wallets) external {
        require(msg.sender == owner, "not owner");
        require(tokenIds.length == wallets.length, "length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            tokenOwner[tokenIds[i]] = wallets[i];
        }
        emit OwnersBatchSet(tokenIds, wallets);
    }

    function setRouter(address router, bool allowed) external {
        require(msg.sender == owner, "not owner");
        authorizedRouter[router] = allowed;
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not owner");
        owner = newOwner;
    }

    // ── Deposit / Withdraw (same as PowerVault, but uses tokenOwner mapping) ──

    function deposit(uint256 tokenId, uint256 amount) external {
        _deposit(tokenId, amount, msg.sender);
    }

    function depositFor(uint256 tokenId, uint256 amount, address user) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _deposit(tokenId, amount, user);
    }

    function _deposit(uint256 tokenId, uint256 amount, address user) internal {
        require(amount > 0, "zero");
        require(tokenOwner[tokenId] == user, "not token owner");
        IERC20(LP_PAIR).transferFrom(msg.sender, address(this), amount);

        uint256 totalFee = (amount * FEE_BPS) / 10000;
        uint256 communityShare = totalFee / 2;
        uint256 lockedShare = totalFee - communityShare;
        uint256 userShare = amount - totalFee;

        if (communityShare > 0) {
            IERC20(LP_PAIR).transfer(COMMUNITY_RECIPIENT, communityShare);
            communityPool += communityShare;
        }

        lockedStake[tokenId] += lockedShare;
        totalLocked += lockedShare;
        totalDeposited[tokenId][user] += amount;

        userStake[tokenId][user] += userShare;
        tokenStake[tokenId] += userShare;
        totalStaked += userShare;

        emit Deposited(user, tokenId, amount, userShare, communityShare, lockedShare);
    }

    function withdraw(uint256 tokenId, uint256 amount) external {
        _withdraw(tokenId, amount, msg.sender, msg.sender);
    }

    function withdrawFor(uint256 tokenId, uint256 amount, address user, address to) external {
        require(authorizedRouter[msg.sender], "not authorized");
        _withdraw(tokenId, amount, user, to);
    }

    function _withdraw(uint256 tokenId, uint256 amount, address user, address to) internal {
        require(amount > 0, "zero");
        require(tokenOwner[tokenId] == user, "not token owner");
        require(userStake[tokenId][user] >= amount, "insufficient");

        userStake[tokenId][user] -= amount;
        tokenStake[tokenId] -= amount;
        totalStaked -= amount;

        IERC20(LP_PAIR).transfer(to, amount);
        emit Withdrawn(user, tokenId, amount);
    }

    function totalBacking(uint256 tokenId) external view returns (uint256) {
        return tokenStake[tokenId] + lockedStake[tokenId];
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        require(token != LP_PAIR, "cannot rescue LP");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 4d: VaultFactory — Deploy PowerVaults for any ERC1155 collection
// ═══════════════════════════════════════════════════════════════════════════

contract VaultFactory {
    address public owner;

    address[] public allVaults;     // all vaults (PowerVault + CrossChainVault)
    bool[] public isCrossChain;     // true = CrossChainVault, false = PowerVault
    mapping(address => address[]) public vaultsByNft;
    mapping(address => mapping(address => address)) public vaultFor;

    event VaultCreated(address indexed nft, address indexed lpPair, address vault, uint256 feeBps, bool crossChain);

    constructor() { owner = msg.sender; }

    /// @notice Deploy a PowerVault (same-chain NFT)
    function createVault(
        address _lpPair,
        address _nft,
        address _communityRecipient,
        uint256 _feeBps
    ) external returns (address) {
        require(vaultFor[_nft][_lpPair] == address(0), "vault exists");

        PowerVault v = new PowerVault(_lpPair, _nft, _communityRecipient, _feeBps);
        address va = address(v);
        allVaults.push(va);
        isCrossChain.push(false);
        vaultsByNft[_nft].push(va);
        vaultFor[_nft][_lpPair] = va;

        emit VaultCreated(_nft, _lpPair, va, _feeBps, false);
        return va;
    }

    /// @notice Deploy a CrossChainVault (NFT on another chain)
    function createCrossChainVault(
        address _lpPair,
        address _nftRef,
        address _communityRecipient,
        uint256 _feeBps
    ) external returns (address) {
        require(vaultFor[_nftRef][_lpPair] == address(0), "vault exists");

        CrossChainVault v = new CrossChainVault(_lpPair, _nftRef, _communityRecipient, _feeBps);
        // Transfer ownership to the caller so they can manage tokenOwner mappings
        v.transferOwnership(msg.sender);

        address va = address(v);
        allVaults.push(va);
        isCrossChain.push(true);
        vaultsByNft[_nftRef].push(va);
        vaultFor[_nftRef][_lpPair] = va;

        emit VaultCreated(_nftRef, _lpPair, va, _feeBps, true);
        return va;
    }

    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    function vaultsForNft(address _nft) external view returns (address[] memory) {
        return vaultsByNft[_nft];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 5: Router — One-click WETH -> Vault (and reverse)
// ═══════════════════════════════════════════════════════════════════════════

contract VaultRouter {
    address public constant WETH    = 0x4200000000000000000000000000000000000006;
    address public constant MFT     = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public constant BURGERS = 0x06A05043eb2C1691b19c2C13219dB9212269dDc5;
    address public constant LP_PAIR = 0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288;

    V4Swapper public immutable v4Swapper;
    V2Swapper public immutable v2Swapper;
    LPManager public immutable lpManager;
    OrkVault  public immutable vault;
    address public owner;

    constructor(address _v4, address _v2, address _lp, address _vault) {
        v4Swapper = V4Swapper(_v4);
        v2Swapper = V2Swapper(_v2);
        lpManager = LPManager(_lp);
        vault     = OrkVault(_vault);
        owner     = msg.sender;
    }

    /// @notice One-click: WETH -> MfT -> split -> BURGERS+MfT -> LP -> Vault
    /// @param wethAmount  Amount of WETH to invest
    /// @param tokenId     Ork NFT token ID to power up
    function powerUp(uint256 wethAmount, uint256 tokenId) external {
        require(wethAmount > 0, "zero");

        // 1. Pull WETH from user
        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);

        // 2. Swap WETH -> MfT via V4
        IERC20(WETH).approve(address(v4Swapper), wethAmount);
        uint256 mftTotal = v4Swapper.swapWETHforMFTTo(wethAmount, 0, address(this));

        // 3. Swap half MfT -> BURGERS via V2
        uint256 halfMft = mftTotal / 2;
        IERC20(MFT).approve(address(v2Swapper), halfMft);
        uint256 burgersAmt = v2Swapper.swapMFTforBURGERS(halfMft, 0, address(this));

        // 4. Add liquidity BURGERS + MfT -> LP
        uint256 remainingMft = IERC20(MFT).balanceOf(address(this));
        IERC20(BURGERS).approve(address(lpManager), burgersAmt);
        IERC20(MFT).approve(address(lpManager), remainingMft);
        (,, uint256 lpAmount) = lpManager.addLiq(burgersAmt, remainingMft, 0, 0, address(this));

        // 5. Deposit LP to vault for token ID, credited to the actual user
        IERC20(LP_PAIR).approve(address(vault), lpAmount);
        vault.depositFor(tokenId, lpAmount, msg.sender);

        // 6. Return any leftover tokens to user
        _returnDust(msg.sender);
    }

    /// @notice One-click: Vault -> LP -> BURGERS+MfT -> MfT -> WETH
    /// @param lpAmount  Amount of LP to withdraw from vault
    /// @param tokenId   Ork NFT token ID to withdraw from
    function powerDown(uint256 lpAmount, uint256 tokenId) external {
        require(lpAmount > 0, "zero");

        // 1. Withdraw LP from vault (user must have staked this amount)
        // User calls vault.withdraw() directly first, then calls this with LP in hand
        IERC20(LP_PAIR).transferFrom(msg.sender, address(this), lpAmount);

        // 2. Remove liquidity -> BURGERS + MfT
        IERC20(LP_PAIR).approve(address(lpManager), lpAmount);
        (uint256 burgersOut, uint256 mftOut) = lpManager.removeLiq(lpAmount, 0, 0, address(this));

        // 3. Swap BURGERS -> MfT via V2
        IERC20(BURGERS).approve(address(v2Swapper), burgersOut);
        uint256 moreMft = v2Swapper.swapBURGERSforMFT(burgersOut, 0, address(this));

        // 4. Swap all MfT -> WETH via V4
        uint256 totalMft = mftOut + moreMft;
        IERC20(MFT).approve(address(v4Swapper), totalMft);
        v4Swapper.swapMFTforWETHTo(totalMft, 0, msg.sender);

        // 5. Return any dust
        _returnDust(msg.sender);
    }

    function _returnDust(address to) internal {
        uint256 b = IERC20(BURGERS).balanceOf(address(this));
        uint256 m = IERC20(MFT).balanceOf(address(this));
        uint256 w = IERC20(WETH).balanceOf(address(this));
        uint256 l = IERC20(LP_PAIR).balanceOf(address(this));
        if (b > 0) IERC20(BURGERS).transfer(to, b);
        if (m > 0) IERC20(MFT).transfer(to, m);
        if (w > 0) IERC20(WETH).transfer(to, w);
        if (l > 0) IERC20(LP_PAIR).transfer(to, l);
    }

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Contract 6: GenericVaultRouter — One-click WETH -> any TOKEN/MfT LP Vault
//   Works with any token pair (BURGERS, TGN, EGP, etc.) and any vault type
//   (PowerVault or CrossChainVault). Single tx for power up AND power down.
// ═══════════════════════════════════════════════════════════════════════════

contract GenericVaultRouter {
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant MFT  = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    V4Swapper public immutable v4Swapper;
    IUniswapV2Router public immutable v2Router;
    address public owner;

    constructor(address _v4, address _v2Router) {
        v4Swapper = V4Swapper(_v4);
        v2Router  = IUniswapV2Router(_v2Router);
        owner     = msg.sender;
    }

    /// @notice One-click: WETH -> MfT -> split -> TOKEN+MfT -> LP -> Vault
    function powerUp(
        uint256 wethAmount,
        uint256 tokenId,
        address token,
        address lpPair,
        address vault
    ) external {
        require(wethAmount > 0, "zero");

        // 1. Pull WETH from user
        IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);

        // 2. WETH -> MfT via V4
        IERC20(WETH).approve(address(v4Swapper), wethAmount);
        uint256 mftTotal = v4Swapper.swapWETHforMFTTo(wethAmount, 0, address(this));

        // 3. Half MfT -> TOKEN via V2 Router
        uint256 halfMft = mftTotal / 2;
        IERC20(MFT).approve(address(v2Router), mftTotal);
        address[] memory path = new address[](2);
        path[0] = MFT;
        path[1] = token;
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            halfMft, 0, path, address(this), block.timestamp
        );
        uint256 tokenAmt = amounts[1];

        // 4. TOKEN + MfT -> LP
        uint256 remainingMft = IERC20(MFT).balanceOf(address(this));
        IERC20(token).approve(address(v2Router), tokenAmt);
        IERC20(MFT).approve(address(v2Router), remainingMft);
        (,, uint256 lpAmount) = v2Router.addLiquidity(
            token, MFT, tokenAmt, remainingMft, 0, 0, address(this), block.timestamp
        );

        // 5. LP -> Vault (credited to msg.sender)
        IERC20(lpPair).approve(vault, lpAmount);
        // depositFor works on both PowerVault and CrossChainVault
        (bool ok,) = vault.call(
            abi.encodeWithSignature("depositFor(uint256,uint256,address)", tokenId, lpAmount, msg.sender)
        );
        require(ok, "deposit failed");

        // 6. Return dust
        _returnDust(msg.sender, token, lpPair);
    }

    /// @notice One-click: Vault -> LP -> TOKEN+MfT -> MfT -> WETH
    function powerDown(
        uint256 lpAmount,
        uint256 tokenId,
        address token,
        address lpPair,
        address vault
    ) external {
        require(lpAmount > 0, "zero");

        // 1. Withdraw LP from vault (sends LP to this router)
        (bool ok,) = vault.call(
            abi.encodeWithSignature("withdrawFor(uint256,uint256,address,address)", tokenId, lpAmount, msg.sender, address(this))
        );
        require(ok, "withdraw failed");

        // 2. LP -> TOKEN + MfT
        IERC20(lpPair).approve(address(v2Router), lpAmount);
        (uint256 tokenOut, uint256 mftOut) = v2Router.removeLiquidity(
            token, MFT, lpAmount, 0, 0, address(this), block.timestamp
        );

        // 3. TOKEN -> MfT via V2
        IERC20(token).approve(address(v2Router), tokenOut);
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = MFT;
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            tokenOut, 0, path, address(this), block.timestamp
        );

        // 4. All MfT -> WETH via V4
        uint256 totalMft = mftOut + amounts[1];
        IERC20(MFT).approve(address(v4Swapper), totalMft);
        v4Swapper.swapMFTforWETHTo(totalMft, 0, msg.sender);

        // 5. Return dust
        _returnDust(msg.sender, token, lpPair);
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

    function rescue(address token) external {
        require(msg.sender == owner, "not owner");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}
