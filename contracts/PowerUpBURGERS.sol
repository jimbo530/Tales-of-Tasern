// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRouter {
    function WETH() external pure returns (address);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory);
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory);
    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint, uint, uint);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transfer(address, uint) external returns (bool);
}

/// @title PowerUp BURGERS — ETH → BURGERS/MfT LP → NFT contract
/// @notice Routes ETH → BURGERS via WETH/BURGERS pair, then half to MfT, adds LP
contract PowerUpBURGERS {
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant BURGERS = 0x06A05043eb2C1691b19c2C13219dB9212269dDc5;
    address public constant MFT = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No ETH");

        // Step 1: Swap ALL ETH → BURGERS via WETH → BURGERS
        address[] memory pathToBurgers = new address[](2);
        pathToBurgers[0] = WETH;
        pathToBurgers[1] = BURGERS;
        router.swapExactETHForTokens{value: msg.value}(0, pathToBurgers, address(this), block.timestamp + 300);

        uint burgersBal = IERC20(BURGERS).balanceOf(address(this));
        uint halfBurgers = burgersBal / 2;

        // Step 2: Swap half BURGERS → MfT
        IERC20(BURGERS).approve(address(router), halfBurgers);
        address[] memory pathToMfT = new address[](2);
        pathToMfT[0] = BURGERS;
        pathToMfT[1] = MFT;
        router.swapExactTokensForTokens(halfBurgers, 0, pathToMfT, address(this), block.timestamp + 300);

        // Step 3: Add liquidity BURGERS + MfT → LP to NFT
        uint balA = IERC20(BURGERS).balanceOf(address(this));
        uint balB = IERC20(MFT).balanceOf(address(this));
        IERC20(BURGERS).approve(address(router), balA);
        IERC20(MFT).approve(address(router), balB);
        (,, uint liq) = router.addLiquidity(BURGERS, MFT, balA, balB, 0, 0, nftContract, block.timestamp + 300);

        // Refund dust
        uint dA = IERC20(BURGERS).balanceOf(address(this));
        uint dB = IERC20(MFT).balanceOf(address(this));
        if (dA > 0) IERC20(BURGERS).transfer(msg.sender, dA);
        if (dB > 0) IERC20(MFT).transfer(msg.sender, dB);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
