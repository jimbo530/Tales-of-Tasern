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

/// @title PowerUp EGP/USDGLO — Polygon
/// @notice POL → EGP (via WPOL→EGP), split, half → USDGLO, adds EGP/USDGLO LP → NFT
contract PowerUpEGPUSDGLO_Polygon {
    IRouter public constant router = IRouter(0xedf6066a2b290C185783862C7F4776A2C8077AD1);
    address public constant WPOL = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    address public constant EGP = 0xc1BA76771bbF0dD841347630E57c793F9d5ACcEe;
    address public constant USDGLO = 0x4F604735c1cF31399C6E711D5962b2B3E0225AD3;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No POL");

        // Step 1: Swap ALL POL → EGP via WPOL → EGP
        address[] memory pathToEgp = new address[](2);
        pathToEgp[0] = WPOL;
        pathToEgp[1] = EGP;
        router.swapExactETHForTokens{value: msg.value}(0, pathToEgp, address(this), block.timestamp + 300);

        uint egpBal = IERC20(EGP).balanceOf(address(this));
        uint halfEgp = egpBal / 2;

        // Step 2: Swap half EGP → USDGLO
        IERC20(EGP).approve(address(router), halfEgp);
        address[] memory pathToUsd = new address[](2);
        pathToUsd[0] = EGP;
        pathToUsd[1] = USDGLO;
        router.swapExactTokensForTokens(halfEgp, 0, pathToUsd, address(this), block.timestamp + 300);

        // Step 3: Add liquidity EGP + USDGLO → LP → NFT
        uint balA = IERC20(EGP).balanceOf(address(this));
        uint balB = IERC20(USDGLO).balanceOf(address(this));
        IERC20(EGP).approve(address(router), balA);
        IERC20(USDGLO).approve(address(router), balB);
        (,, uint liq) = router.addLiquidity(EGP, USDGLO, balA, balB, 0, 0, nftContract, block.timestamp + 300);

        // Refund dust
        uint dA = IERC20(EGP).balanceOf(address(this));
        uint dB = IERC20(USDGLO).balanceOf(address(this));
        if (dA > 0) IERC20(EGP).transfer(msg.sender, dA);
        if (dB > 0) IERC20(USDGLO).transfer(msg.sender, dB);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
