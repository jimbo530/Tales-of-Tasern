// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory);
    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    function allowance(address, address) external view returns (uint);
}

/**
 * @title PowerUp — Tales of Tasern
 * @notice Accept any token, swap to the right LP pair tokens, add liquidity,
 *         and send LP tokens to an NFT contract address to boost its stats.
 * @dev Deployed on Base. Uses Uniswap V2 Router.
 */
contract PowerUpBase {
    IUniswapV2Router02 public immutable router;
    address public owner;

    // Stat → LP pair token addresses
    struct StatPair {
        address tokenA;
        address tokenB;
        address lpPair;
    }

    // statId => StatPair
    mapping(uint8 => StatPair) public statPairs;

    // Accepted payment tokens (stablecoins, ETH, BTC, MfT, game tokens)
    mapping(address => bool) public acceptedTokens;

    event PoweredUp(
        address indexed nftContract,
        address indexed player,
        uint8 statId,
        uint liquidity,
        address paymentToken,
        uint paymentAmount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _router) {
        router = IUniswapV2Router02(_router);
        owner = msg.sender;
    }

    /// @notice Configure which LP pair backs a stat
    function setStatPair(uint8 statId, address tokenA, address tokenB, address lpPair) external onlyOwner {
        statPairs[statId] = StatPair(tokenA, tokenB, lpPair);
    }

    /// @notice Add/remove accepted payment tokens
    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        acceptedTokens[token] = accepted;
    }

    /// @notice Power up an NFT with ETH — swap to LP tokens and deposit
    function powerUpWithETH(address nftContract, uint8 statId) external payable {
        require(msg.value > 0, "No ETH sent");
        StatPair memory sp = statPairs[statId];
        require(sp.tokenA != address(0), "Stat not configured");

        uint half = msg.value / 2;
        address weth = router.WETH();

        // Swap ETH to tokenA
        uint balA;
        if (sp.tokenA == weth) {
            // No swap needed for WETH side
            balA = half;
        } else {
            address[] memory pathA = new address[](2);
            pathA[0] = weth;
            pathA[1] = sp.tokenA;
            router.swapExactETHForTokens{value: half}(0, pathA, address(this), block.timestamp + 300);
            balA = IERC20(sp.tokenA).balanceOf(address(this));
        }

        // Swap ETH to tokenB
        uint balB;
        if (sp.tokenB == weth) {
            balB = msg.value - half;
        } else {
            address[] memory pathB = new address[](2);
            pathB[0] = weth;
            pathB[1] = sp.tokenB;
            router.swapExactETHForTokens{value: msg.value - half}(0, pathB, address(this), block.timestamp + 300);
            balB = IERC20(sp.tokenB).balanceOf(address(this));
        }

        _addLiquidityAndSend(sp, balA, balB, nftContract, msg.sender, statId, weth, msg.value);
    }

    /// @notice Power up an NFT with any accepted ERC20 token
    function powerUpWithToken(address nftContract, uint8 statId, address paymentToken, uint amount) external {
        require(acceptedTokens[paymentToken], "Token not accepted");
        require(amount > 0, "Zero amount");

        IERC20(paymentToken).transferFrom(msg.sender, address(this), amount);

        StatPair memory sp = statPairs[statId];
        require(sp.tokenA != address(0), "Stat not configured");

        uint half = amount / 2;

        // Swap payment to tokenA
        uint balA;
        if (paymentToken == sp.tokenA) {
            balA = half;
        } else {
            balA = _swapTokens(paymentToken, sp.tokenA, half);
        }

        // Swap payment to tokenB
        uint balB;
        if (paymentToken == sp.tokenB) {
            balB = amount - half;
        } else {
            balB = _swapTokens(paymentToken, sp.tokenB, amount - half);
        }

        _addLiquidityAndSend(sp, balA, balB, nftContract, msg.sender, statId, paymentToken, amount);
    }

    function _swapTokens(address from, address to, uint amount) internal returns (uint) {
        IERC20(from).approve(address(router), amount);

        // Try direct swap first
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;

        try router.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp + 300) returns (uint[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            // Try via WETH
            address[] memory path3 = new address[](3);
            path3[0] = from;
            path3[1] = router.WETH();
            path3[2] = to;
            uint[] memory amounts = router.swapExactTokensForTokens(amount, 0, path3, address(this), block.timestamp + 300);
            return amounts[amounts.length - 1];
        }
    }

    function _addLiquidityAndSend(
        StatPair memory sp,
        uint amountA,
        uint amountB,
        address nftContract,
        address player,
        uint8 statId,
        address paymentToken,
        uint paymentAmount
    ) internal {
        IERC20(sp.tokenA).approve(address(router), amountA);
        IERC20(sp.tokenB).approve(address(router), amountB);

        // Add liquidity — send LP directly to the NFT contract
        (, , uint liquidity) = router.addLiquidity(
            sp.tokenA,
            sp.tokenB,
            amountA,
            amountB,
            0, // accept any slippage
            0,
            nftContract, // LP tokens go to the NFT!
            block.timestamp + 300
        );

        // Refund dust
        _refundDust(sp.tokenA, player);
        _refundDust(sp.tokenB, player);

        emit PoweredUp(nftContract, player, statId, liquidity, paymentToken, paymentAmount);
    }

    function _refundDust(address token, address to) internal {
        uint bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(to, bal);
    }

    /// @notice Rescue stuck tokens
    function rescue(address token, uint amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    /// @notice Rescue stuck ETH
    function rescueETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
