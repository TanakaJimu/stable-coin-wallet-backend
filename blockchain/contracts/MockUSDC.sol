// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MockUSDC
 * @dev Mock USD Coin (USDC) for testnets. ERC20 with 6 decimals and MINTER_ROLE.
 */
contract MockUSDC is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address defaultAdmin) ERC20("Mock USD Coin", "USDC") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
    }

    /**
     * @dev Returns the number of decimals (6, like real USDC).
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Mints tokens to an address. Callable only by accounts with MINTER_ROLE.
     * @param to Recipient address.
     * @param amount Amount to mint (in 6-decimal units).
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
