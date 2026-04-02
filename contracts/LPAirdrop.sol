// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title LP Airdrop — batch send ERC20 tokens to NFT contracts
/// @notice Caller must approve this contract for totalAmount before calling airdrop
contract LPAirdrop {
    function airdrop(address token, address[] calldata recipients, uint256 amountEach) external {
        for (uint i = 0; i < recipients.length; i++) {
            IERC20(token).transferFrom(msg.sender, recipients[i], amountEach);
        }
    }
}
