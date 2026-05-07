// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BaselingItems — ERC1155 item NFTs for Baseling equipment
/// @notice Hats, shoes, accessories. Each item type is a token ID.
///         Multiple players can own the same hat type.

interface IERC1155Receiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4);
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external returns (bytes4);
}

contract BaselingItems {
    string public name = "Baseling Items";
    string public symbol = "BITEM";
    address public owner;
    string private _uri;

    // balances[tokenId][account]
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    // operator approvals
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    // Item definitions
    struct ItemDef {
        string name;
        uint8 slot;        // 0=head, 1=acc, 2=feet
        uint8 rarity;      // 0=common,1=uncommon,2=rare,3=legendary
        uint256 price;     // WETH price (0 = not for sale / airdrop only)
        uint256 maxSupply; // 0 = unlimited
        uint256 minted;
    }
    mapping(uint256 => ItemDef) public items;
    uint256 public nextItemId = 1;

    address public weth;
    address public powerPlant;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);
    event ItemCreated(uint256 indexed id, string name, uint8 slot, uint8 rarity, uint256 price);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _weth, address _powerPlant, string memory baseURI) {
        owner = msg.sender;
        weth = _weth;
        powerPlant = _powerPlant;
        _uri = baseURI;
    }

    // --- Admin: create item types ---
    function createItem(
        string calldata _name,
        uint8 _slot,
        uint8 _rarity,
        uint256 _price,
        uint256 _maxSupply
    ) external onlyOwner returns (uint256 id) {
        id = nextItemId++;
        items[id] = ItemDef(_name, _slot, _rarity, _price, _maxSupply, 0);
        emit ItemCreated(id, _name, _slot, _rarity, _price);
    }

    function setItemPrice(uint256 id, uint256 _price) external onlyOwner {
        require(bytes(items[id].name).length > 0, "no item");
        items[id].price = _price;
    }

    // --- Buy item with WETH ---
    function buyItem(uint256 id, uint256 qty) external {
        ItemDef storage item = items[id];
        require(bytes(item.name).length > 0, "no item");
        require(item.price > 0, "not for sale");
        require(item.maxSupply == 0 || item.minted + qty <= item.maxSupply, "sold out");

        uint256 cost = item.price * qty;
        // Pull WETH from buyer → power plant
        (bool ok,) = weth.call(abi.encodeWithSignature(
            "transferFrom(address,address,uint256)", msg.sender, powerPlant, cost
        ));
        require(ok, "weth transfer failed");

        item.minted += qty;
        balanceOf[id][msg.sender] += qty;
        emit TransferSingle(msg.sender, address(0), msg.sender, id, qty);
    }

    // --- Admin mint (airdrops, rewards) ---
    function mint(address to, uint256 id, uint256 qty) external onlyOwner {
        ItemDef storage item = items[id];
        require(bytes(item.name).length > 0, "no item");
        require(item.maxSupply == 0 || item.minted + qty <= item.maxSupply, "sold out");
        item.minted += qty;
        balanceOf[id][to] += qty;
        emit TransferSingle(msg.sender, address(0), to, id, qty);
    }

    // --- ERC1155 core ---
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balanceOf[id][from] >= amount, "insufficient");
        balanceOf[id][from] -= amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
        if (to.code.length > 0) {
            require(
                IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, amount, data) == 0xf23a6e61,
                "unsafe recipient"
            );
        }
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(ids.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            require(balanceOf[ids[i]][from] >= amounts[i], "insufficient");
            balanceOf[ids[i]][from] -= amounts[i];
            balanceOf[ids[i]][to] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
        if (to.code.length > 0) {
            require(
                IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, amounts, data) == 0xbc197c81,
                "unsafe recipient"
            );
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory bals) {
        require(accounts.length == ids.length, "length mismatch");
        bals = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            bals[i] = balanceOf[ids[i]][accounts[i]];
        }
    }

    function uri(uint256 id) external view returns (string memory) {
        return string(abi.encodePacked(_uri, _toString(id)));
    }

    function setURI(string calldata newURI) external onlyOwner { _uri = newURI; }
    function setPowerPlant(address pp) external onlyOwner { powerPlant = pp; }
    function transferOwnership(address newOwner) external onlyOwner { owner = newOwner; }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0xd9b67a26 || interfaceId == 0x0e89341c || interfaceId == 0x01ffc9a7;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + uint256(value % 10))); value /= 10; }
        return string(buffer);
    }
}
