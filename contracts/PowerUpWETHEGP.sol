// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRouter {
    function WETH() external pure returns (address);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory);
    function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transfer(address, uint) external returns (bool);
}

/// @title PowerUp WETH/EGP — ETH → WETH/EGP LP → NFT contract
/// @notice Half ETH stays as WETH, half swaps to EGP, adds WETH/EGP LP.
///         Builds WETH/EGP liquidity while powering up heroes.
contract PowerUpWETHEGP {
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant EGP = 0xc1BA76771bbF0dD841347630E57c793F9d5ACcEe;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No ETH");

        uint half = msg.value / 2;

        // Step 1: Swap half ETH → EGP
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = EGP;
        router.swapExactETHForTokens{value: half}(0, path, address(this), block.timestamp + 300);

        // Step 2: Add liquidity ETH + EGP → WETH/EGP LP → NFT
        uint egpBal = IERC20(EGP).balanceOf(address(this));
        IERC20(EGP).approve(address(router), egpBal);
        (,, uint liq) = router.addLiquidityETH{value: msg.value - half}(
            EGP,
            egpBal,
            0,
            0,
            nftContract, // LP goes to NFT contract
            block.timestamp + 300
        );

        // Refund dust
        uint dEgp = IERC20(EGP).balanceOf(address(this));
        if (dEgp > 0) IERC20(EGP).transfer(msg.sender, dEgp);
        uint dEth = address(this).balance;
        if (dEth > 0) payable(msg.sender).transfer(dEth);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
