// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StableCoinWallet
 * @dev ERC20 stablecoin for the wallet system
 * Mints initial supply to deployer and allows owner to mint additional tokens
 */
contract StableCoinWallet is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Stable Coin Wallet", "SCW") Ownable(initialOwner) {
        uint256 initialSupply = 1_000_000 * 10**decimals();
        _mint(initialOwner, initialSupply);
    }

    /**
     * @dev Mint tokens to a specific address (owner only)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
