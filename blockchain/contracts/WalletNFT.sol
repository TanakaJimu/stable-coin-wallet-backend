// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WalletNFT is ERC721URIStorage, Ownable {
    IERC20 public immutable paymentToken;
    address public treasury;

    uint256 public mintPrice;   // in paymentToken smallest units (18 decimals if SWC)
    uint256 public maxSupply;
    uint256 public totalMinted;

    bool public publicMintActive;

    error PublicMintClosed();
    error SoldOut();
    error PaymentFailed();

    constructor(
        address initialOwner,
        address paymentTokenAddress,
        address treasuryAddress,
        uint256 price,
        uint256 supplyCap
    ) ERC721("Wallet NFT", "WNFT") Ownable(initialOwner) {
        paymentToken = IERC20(paymentTokenAddress);
        treasury = treasuryAddress;
        mintPrice = price;
        maxSupply = supplyCap;
        publicMintActive = true;
    }

    function setPublicMintActive(bool active) external onlyOwner {
        publicMintActive = active;
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        treasury = newTreasury;
    }

    function mint(string calldata tokenUri) external returns (uint256 tokenId) {
        if (!publicMintActive) revert PublicMintClosed();
        if (totalMinted >= maxSupply) revert SoldOut();

        // Pull stablecoin payment
        bool ok = paymentToken.transferFrom(msg.sender, treasury, mintPrice);
        if (!ok) revert PaymentFailed();

        tokenId = ++totalMinted;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }
}
