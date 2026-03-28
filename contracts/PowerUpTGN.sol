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

/// @title PowerUp TGN — ETH → TGN/MfT LP → NFT contract
contract PowerUpTGN {
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant TGN = 0xD75dfa972C6136f1c594Fec1945302f885E1ab29;
    address public constant MFT = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;
    address public constant EGP = 0xc1BA76771bbF0dD841347630E57c793F9d5ACcEe;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No ETH");

        // Step 1: Swap ALL ETH → TGN via WETH → EGP → TGN
        address[] memory pathToTGN = new address[](3);
        pathToTGN[0] = WETH;
        pathToTGN[1] = EGP;
        pathToTGN[2] = TGN;
        router.swapExactETHForTokens{value: msg.value}(0, pathToTGN, address(this), block.timestamp + 300);

        uint tgnBal = IERC20(TGN).balanceOf(address(this));
        uint halfTGN = tgnBal / 2;

        // Step 2: Swap half TGN → MfT
        IERC20(TGN).approve(address(router), halfTGN);
        address[] memory pathToMfT = new address[](2);
        pathToMfT[0] = TGN;
        pathToMfT[1] = MFT;
        router.swapExactTokensForTokens(halfTGN, 0, pathToMfT, address(this), block.timestamp + 300);

        // Step 3: Add liquidity TGN + MfT → LP to NFT
        uint balA = IERC20(TGN).balanceOf(address(this));
        uint balB = IERC20(MFT).balanceOf(address(this));
        IERC20(TGN).approve(address(router), balA);
        IERC20(MFT).approve(address(router), balB);
        (,, uint liq) = router.addLiquidity(TGN, MFT, balA, balB, 0, 0, nftContract, block.timestamp + 300);

        // Refund dust
        uint dA = IERC20(TGN).balanceOf(address(this));
        uint dB = IERC20(MFT).balanceOf(address(this));
        if (dA > 0) IERC20(TGN).transfer(msg.sender, dA);
        if (dB > 0) IERC20(MFT).transfer(msg.sender, dB);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
