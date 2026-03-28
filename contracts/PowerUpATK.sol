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

/// @title PowerUp ATK v3 — ETH → USDGLO/MfT LP → NFT contract
/// @notice Routes through EGP since no direct WETH/USDGLO or WETH/MfT pairs exist
contract PowerUpATK {
    IRouter public constant router = IRouter(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant EGP = 0xc1BA76771bbF0dD841347630E57c793F9d5ACcEe;
    address public constant USDGLO = 0x4F604735c1cF31399C6E711D5962b2B3E0225AD3;
    address public constant MFT = 0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3;

    event PoweredUp(address indexed nft, address indexed player, uint liquidity);

    function powerUp(address nftContract) external payable {
        require(msg.value > 0, "No ETH");

        // Step 1: Swap ALL ETH → MfT via path WETH → EGP → MfT
        address[] memory pathToMft = new address[](3);
        pathToMft[0] = WETH;
        pathToMft[1] = EGP;
        pathToMft[2] = MFT;
        router.swapExactETHForTokens{value: msg.value}(0, pathToMft, address(this), block.timestamp + 300);

        uint mftBal = IERC20(MFT).balanceOf(address(this));
        uint halfMft = mftBal / 2;

        // Step 2: Swap half MfT → USDGLO
        IERC20(MFT).approve(address(router), halfMft);
        address[] memory pathToUsd = new address[](2);
        pathToUsd[0] = MFT;
        pathToUsd[1] = USDGLO;
        router.swapExactTokensForTokens(halfMft, 0, pathToUsd, address(this), block.timestamp + 300);

        // Step 3: Add liquidity USDGLO + MfT → LP to NFT
        uint balA = IERC20(USDGLO).balanceOf(address(this));
        uint balB = IERC20(MFT).balanceOf(address(this));
        IERC20(USDGLO).approve(address(router), balA);
        IERC20(MFT).approve(address(router), balB);
        (,, uint liq) = router.addLiquidity(USDGLO, MFT, balA, balB, 0, 0, nftContract, block.timestamp + 300);

        // Refund dust
        uint dA = IERC20(USDGLO).balanceOf(address(this));
        uint dB = IERC20(MFT).balanceOf(address(this));
        if (dA > 0) IERC20(USDGLO).transfer(msg.sender, dA);
        if (dB > 0) IERC20(MFT).transfer(msg.sender, dB);

        emit PoweredUp(nftContract, msg.sender, liq);
    }

    receive() external payable {}
}
