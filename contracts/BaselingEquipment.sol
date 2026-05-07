// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BaselingEquipment — Item locker / equipment system
/// @notice Equip ERC1155 items to Baseling NFTs. Items auto-follow
///         on marketplace sales — no BaselingNFT modification needed.
///         Authorization is always via baselingNFT.ownerOf(tokenId).

interface IBaselingNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC1155 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function balanceOf(uint256 id, address account) external view returns (uint256);
}

contract BaselingEquipment {
    IBaselingNFT public baselingNFT;
    address public owner;

    // Slot types: 0=head, 1=accessory, 2=feet
    uint8 public constant MAX_SLOTS = 3;

    struct EquippedItem {
        address itemContract; // ERC1155 contract
        uint256 itemId;       // token ID within that contract
        bool equipped;
    }

    // baselingId => slot => equipped item
    mapping(uint256 => mapping(uint8 => EquippedItem)) public equipped;

    // Track which item contracts are allowed
    mapping(address => bool) public allowedItems;

    event Equip(uint256 indexed baselingId, uint8 slot, address itemContract, uint256 itemId);
    event Unequip(uint256 indexed baselingId, uint8 slot, address itemContract, uint256 itemId);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    modifier onlyBaselingOwner(uint256 baselingId) {
        require(baselingNFT.ownerOf(baselingId) == msg.sender, "not baseling owner");
        _;
    }

    constructor(address _baselingNFT) {
        owner = msg.sender;
        baselingNFT = IBaselingNFT(_baselingNFT);
    }

    /// @notice Equip an item to a baseling slot
    /// @param baselingId The baseling token ID
    /// @param slot Equipment slot (0=head, 1=acc, 2=feet)
    /// @param itemContract The ERC1155 item contract
    /// @param itemId The item token ID
    function equip(
        uint256 baselingId,
        uint8 slot,
        address itemContract,
        uint256 itemId
    ) external onlyBaselingOwner(baselingId) {
        require(slot < MAX_SLOTS, "invalid slot");
        require(allowedItems[itemContract], "item contract not allowed");

        // If slot already has an item, unequip it first
        EquippedItem storage current = equipped[baselingId][slot];
        if (current.equipped) {
            _returnItem(baselingId, slot);
        }

        // Transfer item from player to this contract
        IERC1155(itemContract).safeTransferFrom(msg.sender, address(this), itemId, 1, "");

        equipped[baselingId][slot] = EquippedItem(itemContract, itemId, true);
        emit Equip(baselingId, slot, itemContract, itemId);
    }

    /// @notice Unequip an item from a baseling slot
    /// @param baselingId The baseling token ID
    /// @param slot Equipment slot to clear
    function unequip(
        uint256 baselingId,
        uint8 slot
    ) external onlyBaselingOwner(baselingId) {
        require(slot < MAX_SLOTS, "invalid slot");
        _returnItem(baselingId, slot);
    }

    /// @notice View all equipped items for a baseling
    function getEquipment(uint256 baselingId) external view returns (
        EquippedItem memory head,
        EquippedItem memory acc,
        EquippedItem memory feet
    ) {
        head = equipped[baselingId][0];
        acc  = equipped[baselingId][1];
        feet = equipped[baselingId][2];
    }

    /// @notice Check if a specific slot is equipped
    function isEquipped(uint256 baselingId, uint8 slot) external view returns (bool) {
        return equipped[baselingId][slot].equipped;
    }

    // --- Admin ---
    function setAllowedItems(address itemContract, bool allowed) external onlyOwner {
        allowedItems[itemContract] = allowed;
    }

    function setBaselingNFT(address _nft) external onlyOwner {
        baselingNFT = IBaselingNFT(_nft);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // --- Internal ---
    function _returnItem(uint256 baselingId, uint8 slot) internal {
        EquippedItem storage item = equipped[baselingId][slot];
        require(item.equipped, "slot empty");

        address recipient = baselingNFT.ownerOf(baselingId);
        IERC1155(item.itemContract).safeTransferFrom(address(this), recipient, item.itemId, 1, "");

        emit Unequip(baselingId, slot, item.itemContract, item.itemId);
        delete equipped[baselingId][slot];
    }

    // ERC1155 receiver — must implement to hold items
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return 0xbc197c81;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x4e2312e0;
    }
}
