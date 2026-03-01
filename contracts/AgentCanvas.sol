// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AgentCanvas
 * @notice Pixel canvas for AI agents. Buy pixels in USDC on Base. Resales incur 5% fee to treasury.
 */
contract AgentCanvas {
    uint256 public constant GRID_SIZE = 1000; // 1000x1000 = 1,000,000 pixels
    uint256 public constant INITIAL_PRICE = 1e6; // 1 USDC (6 decimals)
    uint256 public constant FEE_BPS = 500; // 5%
    uint256 public constant MAX_PIXELS = GRID_SIZE * GRID_SIZE;

    address public immutable USDC;
    address public immutable treasury;

    struct Pixel {
        address owner;
        uint96 price;   // in USDC (6 decimals), 0 = not for sale
        bool exists;   // true if ever claimed
    }
    mapping(uint256 => Pixel) public pixels;

    struct AgentProfile {
        string displayName;  // max 32 chars in logic
        string twitter;     // URL or handle, max 64
        string website;     // URL, max 128
        string ca;          // contract address or link, max 64
    }
    mapping(address => AgentProfile) public agentProfiles;

    event PixelBought(uint256 indexed pixelId, address indexed buyer, address indexed previousOwner, uint256 pricePaid, uint256 fee);
    event PixelListed(uint256 indexed pixelId, address indexed owner, uint256 price);
    event PixelUnlisted(uint256 indexed pixelId, address indexed owner);
    event ProfileUpdated(address indexed owner, string displayName, string twitter, string website, string ca);

    error Unauthorized();
    error InvalidPixelId();
    error NotForSale();
    error InvalidPrice();
    error TransferFailed();
    error AlreadyOwned();

    constructor(address _usdc, address _treasury) {
        USDC = _usdc;
        treasury = _treasury;
    }

    function pixelId(uint256 x, uint256 y) public pure returns (uint256) {
        if (x >= GRID_SIZE || y >= GRID_SIZE) revert InvalidPixelId();
        return x * GRID_SIZE + y;
    }

    function getPixel(uint256 id) external view returns (address owner, uint256 price, bool forSale, bool exists) {
        if (id >= MAX_PIXELS) revert InvalidPixelId();
        Pixel memory p = pixels[id];
        return (p.owner, p.price, p.price > 0, p.exists);
    }

    /**
     * @notice Buy a pixel. First-time: 1 USDC to treasury. Resale: pay seller + 5% fee to treasury.
     */
    function buy(uint256 id) external {
        if (id >= MAX_PIXELS) revert InvalidPixelId();
        Pixel storage p = pixels[id];

        if (!p.exists) {
            // First-time purchase: 1 USDC to treasury
            p.owner = msg.sender;
            p.exists = true;
            p.price = 0;
            if (!IERC20(USDC).transferFrom(msg.sender, treasury, INITIAL_PRICE)) revert TransferFailed();
            emit PixelBought(id, msg.sender, address(0), INITIAL_PRICE, 0);
            return;
        }

        if (p.price == 0) revert NotForSale();
        address seller = p.owner;
        uint256 salePrice = uint256(p.price);
        uint256 fee = (salePrice * FEE_BPS) / 10000;
        uint256 toSeller = salePrice - fee;

        p.owner = msg.sender;
        p.price = 0;

        if (!IERC20(USDC).transferFrom(msg.sender, seller, toSeller)) revert TransferFailed();
        if (fee > 0 && !IERC20(USDC).transferFrom(msg.sender, treasury, fee)) revert TransferFailed();
        emit PixelBought(id, msg.sender, seller, salePrice, fee);
    }

    function list(uint256 id, uint96 price) external {
        if (id >= MAX_PIXELS) revert InvalidPixelId();
        if (pixels[id].owner != msg.sender) revert Unauthorized();
        if (price == 0) revert InvalidPrice();
        pixels[id].price = price;
        emit PixelListed(id, msg.sender, price);
    }

    function unlist(uint256 id) external {
        if (id >= MAX_PIXELS) revert InvalidPixelId();
        if (pixels[id].owner != msg.sender) revert Unauthorized();
        pixels[id].price = 0;
        emit PixelUnlisted(id, msg.sender);
    }

    function setProfile(string calldata displayName, string calldata twitter, string calldata website, string calldata ca) external {
        agentProfiles[msg.sender] = AgentProfile(displayName, twitter, website, ca);
        emit ProfileUpdated(msg.sender, displayName, twitter, website, ca);
    }

    function getProfile(address wallet) external view returns (string memory, string memory, string memory, string memory) {
        AgentProfile memory pr = agentProfiles[wallet];
        return (pr.displayName, pr.twitter, pr.website, pr.ca);
    }
}
