// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZicoRushBadge
 * @dev ERC-721 NFT Badge for Zico Rush GameFi
 *      - Mint costs a fee (~$2 in ETH), fee stored in contract
 *      - One mint per wallet
 *      - Owner can withdraw fees & update mint price
 *
 * Deploy via Remix IDE on Base Network (Chain ID 8453)
 * Uses OpenZeppelin contracts via import
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ZicoRushBadge is ERC721, Ownable {
    using Strings for uint256;

    // ── State Variables ──
    uint256 public mintPrice;          // Price in wei (set to ~$2 worth of ETH)
    uint256 public totalSupply;        // Total minted count
    uint256 public maxSupply;          // Max supply (0 = unlimited)
    string  public baseTokenURI;       // Metadata base URI
    bool    public mintEnabled;        // Pause/unpause minting

    // Track who has minted (1 per wallet)
    mapping(address => bool) public hasMinted;

    // ── Events ──
    event BadgeMinted(address indexed minter, uint256 indexed tokenId, uint256 pricePaid);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event MintStatusChanged(bool enabled);

    // ── Constructor ──
    constructor(
        uint256 _mintPrice,
        string memory _baseTokenURI
    ) ERC721("Zico Rush Early Adopter", "ZRUSH") Ownable(msg.sender) {
        mintPrice = _mintPrice;
        baseTokenURI = _baseTokenURI;
        maxSupply = 0;           // Unlimited by default
        mintEnabled = true;
        totalSupply = 0;
    }

    // ── Mint Function ──
    function mint() external payable {
        require(mintEnabled, "Minting is paused");
        require(!hasMinted[msg.sender], "Already minted");
        require(msg.value >= mintPrice, "Insufficient ETH");
        require(maxSupply == 0 || totalSupply < maxSupply, "Max supply reached");

        totalSupply++;
        uint256 tokenId = totalSupply;

        hasMinted[msg.sender] = true;
        _safeMint(msg.sender, tokenId);

        // Refund excess ETH if overpaid
        if (msg.value > mintPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - mintPrice}("");
            require(refundSuccess, "Refund failed");
        }

        emit BadgeMinted(msg.sender, tokenId, mintPrice);
    }

    // ── Token URI ──
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= totalSupply, "Token does not exist");

        if (bytes(baseTokenURI).length > 0) {
            return string(abi.encodePacked(baseTokenURI, tokenId.toString(), ".json"));
        }

        // Default on-chain metadata if no baseURI set
        return string(abi.encodePacked(
            "data:application/json;utf8,{",
            '"name":"Zico Rush Early Adopter #', tokenId.toString(), '",',
            '"description":"Early Adopter NFT Badge for Zico Rush GameFi. Grants Whitelist status and bonus points.",',
            '"image":"https://raw.githubusercontent.com/nicefuture1/zicorush/main/badge.png",',
            '"attributes":[{"trait_type":"Type","value":"Early Adopter"},{"trait_type":"Season","value":"1"}]',
            "}"
        ));
    }

    // ── Owner Functions ──

    /// @notice Update mint price (in wei)
    function setMintPrice(uint256 _newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = _newPrice;
        emit MintPriceUpdated(oldPrice, _newPrice);
    }

    /// @notice Set base URI for token metadata
    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseTokenURI = _newBaseURI;
    }

    /// @notice Set max supply (0 = unlimited)
    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        maxSupply = _maxSupply;
    }

    /// @notice Enable/disable minting
    function setMintEnabled(bool _enabled) external onlyOwner {
        mintEnabled = _enabled;
        emit MintStatusChanged(_enabled);
    }

    /// @notice Withdraw all collected fees to owner
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(owner(), balance);
    }

    /// @notice Check contract ETH balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Allow contract to receive ETH directly
    receive() external payable {}
}
