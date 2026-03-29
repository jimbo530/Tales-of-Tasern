// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPowerUp {
    function powerUp(address nftContract) external payable;
}

/// @title RewardPool — Tales of Tasern (Base)
/// @notice Owner-funded pool that sends LP rewards to hero NFTs when players win battles.
///         Players pay nothing. Owner pre-funds with ETH. Per-NFT 24hr cooldown prevents spam.
contract RewardPoolBase {
    address public owner;
    IPowerUp public immutable powerUpContract;
    uint256 public rewardAmount = 0.000005 ether; // ~$0.01 per hero
    uint256 public cooldown = 24 hours;

    // nftContract => last reward timestamp
    mapping(address => uint256) public lastReward;

    event HeroRewarded(address indexed nftContract, address indexed player, uint256 amount);
    event FundsDeposited(address indexed from, uint256 amount);
    event RewardAmountUpdated(uint256 newAmount);
    event CooldownUpdated(uint256 newCooldown);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _powerUp) {
        owner = msg.sender;
        powerUpContract = IPowerUp(_powerUp);
    }

    /// @notice Reward a hero NFT with LP. Anyone can call, but cooldown prevents spam.
    /// @dev LP goes to the NFT contract, not the caller. Worst case abuse = free LP to an NFT.
    function rewardHero(address nftContract) external {
        require(nftContract != address(0), "Zero address");
        require(address(this).balance >= rewardAmount, "Pool empty");
        require(block.timestamp >= lastReward[nftContract] + cooldown, "On cooldown");

        lastReward[nftContract] = block.timestamp;
        powerUpContract.powerUp{value: rewardAmount}(nftContract);

        emit HeroRewarded(nftContract, msg.sender, rewardAmount);
    }

    /// @notice Check if an NFT can be rewarded (off cooldown)
    function canReward(address nftContract) external view returns (bool) {
        return block.timestamp >= lastReward[nftContract] + cooldown;
    }

    /// @notice Seconds until cooldown expires for an NFT
    function cooldownRemaining(address nftContract) external view returns (uint256) {
        uint256 ready = lastReward[nftContract] + cooldown;
        if (block.timestamp >= ready) return 0;
        return ready - block.timestamp;
    }

    /// @notice Owner updates the reward amount
    function setRewardAmount(uint256 _amount) external onlyOwner {
        rewardAmount = _amount;
        emit RewardAmountUpdated(_amount);
    }

    /// @notice Owner updates the cooldown period
    function setCooldown(uint256 _cooldown) external onlyOwner {
        cooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    /// @notice Owner withdraws remaining ETH
    function withdraw() external onlyOwner {
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    /// @notice Accept ETH deposits
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
}
