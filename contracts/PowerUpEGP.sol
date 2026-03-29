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

/// @title PowerUp EGP — ETH → EGP/MfT LP → NFT contract
/// @notice Routes ETH → EGP via WETH/EGP pair, splits, swaps half to MfT, adds EGP/MfT LP
contract PowerUpEGP {
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant EGP = 0xc1BA76771bbF0dD841347630E57c793F9d5ACcEe;
    address public constant MFT = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No ETH");

        // Step 1: Swap ALL ETH → EGP via WETH → EGP
        address[] memory pathToEgp = new address[](2);
        pathToEgp[0] = WETH;
        pathToEgp[1] = EGP;
        router.swapExactETHForTokens{value: msg.value}(0, pathToEgp, address(this), block.timestamp + 300);

        uint egpBal = IERC20(EGP).balanceOf(address(this));
        uint halfEgp = egpBal / 2;

        // Step 2: Swap half EGP → MfT
        IERC20(EGP).approve(address(router), halfEgp);
        address[] memory pathToMft = new address[](2);
        pathToMft[0] = EGP;
        pathToMft[1] = MFT;
        router.swapExactTokensForTokens(halfEgp, 0, pathToMft, address(this), block.timestamp + 300);

        // Step 3: Add liquidity EGP + MfT → LP to NFT
        uint balA = IERC20(EGP).balanceOf(address(this));
        uint balB = IERC20(MFT).balanceOf(address(this));
        IERC20(EGP).approve(address(router), balA);
        IERC20(MFT).approve(address(router), balB);
        (,, uint liq) = router.addLiquidity(EGP, MFT, balA, balB, 0, 0, nftContract, block.timestamp + 300);

        // Refund dust
        uint dA = IERC20(EGP).balanceOf(address(this));
        uint dB = IERC20(MFT).balanceOf(address(this));
        if (dA > 0) IERC20(EGP).transfer(msg.sender, dA);
        if (dB > 0) IERC20(MFT).transfer(msg.sender, dB);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
