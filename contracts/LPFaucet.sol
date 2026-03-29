// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint);
    function transfer(address, uint) external returns (bool);
}

/// @title LP Faucet — Tales of Tasern
/// @notice Holds LP tokens. Sends a fixed amount to hero NFT contracts when players beat a level.
///         Owner deposits LP, sets reward amount. Per-NFT 24hr cooldown prevents abuse.
contract LPFaucet {
    address public owner;
    IERC20 public lpToken;
    uint256 public rewardAmount; // LP tokens per win (in wei)
    uint256 public cooldown = 24 hours;

    // nftContract => last reward timestamp
    mapping(address => uint256) public lastReward;

    event HeroRewarded(address indexed nftContract, address indexed player, uint256 amount);
    event RewardAmountUpdated(uint256 newAmount);
    event LPTokenUpdated(address newToken);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _lpToken, uint256 _rewardAmount) {
        owner = msg.sender;
        lpToken = IERC20(_lpToken);
        rewardAmount = _rewardAmount;
    }

    /// @notice Send LP reward to a hero NFT. Anyone can call — LP goes to NFT, not caller.
    function rewardHero(address nftContract) external {
        require(nftContract != address(0), "Zero address");
        require(lpToken.balanceOf(address(this)) >= rewardAmount, "Faucet empty");
        require(block.timestamp >= lastReward[nftContract] + cooldown, "On cooldown");

        lastReward[nftContract] = block.timestamp;
        lpToken.transfer(nftContract, rewardAmount);

        emit HeroRewarded(nftContract, msg.sender, rewardAmount);
    }

    /// @notice Check if an NFT can be rewarded
    function canReward(address nftContract) external view returns (bool) {
        return block.timestamp >= lastReward[nftContract] + cooldown
            && lpToken.balanceOf(address(this)) >= rewardAmount;
    }

    /// @notice Seconds until cooldown expires
    function cooldownRemaining(address nftContract) external view returns (uint256) {
        uint256 ready = lastReward[nftContract] + cooldown;
        if (block.timestamp >= ready) return 0;
        return ready - block.timestamp;
    }

    /// @notice Remaining LP in faucet
    function balance() external view returns (uint256) {
        return lpToken.balanceOf(address(this));
    }

    // ── Owner functions ──

    function setRewardAmount(uint256 _amount) external onlyOwner {
        rewardAmount = _amount;
        emit RewardAmountUpdated(_amount);
    }

    function setLPToken(address _token) external onlyOwner {
        lpToken = IERC20(_token);
        emit LPTokenUpdated(_token);
    }

    function setCooldown(uint256 _cooldown) external onlyOwner {
        cooldown = _cooldown;
    }

    /// @notice Withdraw LP back to owner
    function withdraw(uint256 amount) external onlyOwner {
        lpToken.transfer(owner, amount);
    }

    /// @notice Withdraw any stuck token
    function rescue(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
}
