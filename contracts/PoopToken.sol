// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * 💩 Token — ERC20 minted by BaselingNFT vault from LP fee accrual
 *
 * - Minter role granted to BaselingNFT contract
 * - mint() on claim for active baselings (fees → owner)
 * - burn() for frozen/dead baselings (fees → deflation)
 * - Tracks totalMinted + totalBurned separately for on-chain stats
 * - circulatingSupply = totalMinted - totalBurned
 * - No max supply — emissions controlled by real LP fee revenue
 * - 1 💩 = $0.01 of LP fees collected
 */
contract PoopToken {
    string public constant name = "Poop";
    string public constant symbol = unicode"💩";
    uint8  public constant decimals = 18;

    uint256 public totalSupply;
    uint256 public totalMinted;     // lifetime minted (never decreases)
    uint256 public totalBurned;     // lifetime burned (never decreases)
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isMinter;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterSet(address indexed account, bool status);
    event OwnershipTransferred(address indexed prev, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender], "not minter");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- MINTER MANAGEMENT ---

    function setMinter(address account, bool status) external onlyOwner {
        isMinter[account] = status;
        emit MinterSet(account, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --- MINT (called by BaselingNFT on fee claim for active baselings) ---

    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "zero address");
        totalSupply += amount;
        totalMinted += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // --- BURN (called by BaselingNFT for frozen/dead baselings) ---
    // Fees still accrue but tokens are burned — shows on-chain as deflation

    function burn(uint256 amount) external onlyMinter {
        totalBurned += amount;
        // mint then burn = totalMinted goes up, totalSupply stays same
        // on-chain proof that value was generated but destroyed
        totalMinted += amount;
        emit Transfer(address(0), address(0xdead), amount);
    }

    // --- HOLDER BURN (anyone can burn their own tokens) ---

    function burnFrom(address from, uint256 amount) external {
        if (from != msg.sender) {
            require(allowance[from][msg.sender] >= amount, "not approved");
            allowance[from][msg.sender] -= amount;
        }
        require(balanceOf[from] >= amount, "insufficient");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        totalBurned += amount;
        emit Transfer(from, address(0), amount);
    }

    // --- VIEW ---

    function circulatingSupply() external view returns (uint256) {
        return totalSupply;
    }

    // --- STANDARD ERC20 ---

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "not approved");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
