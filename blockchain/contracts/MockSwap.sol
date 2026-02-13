// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MockSwap
 * @dev Simple fixed-rate swap for MockUSDT <-> MockUSDC on testnets.
 *      Holds liquidity; swaps at configurable rate (default 1:1) and charges a fee.
 *      Emits Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee)
 */
contract MockSwap is ReentrancyGuard {
    event Swap(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    address public immutable tokenA;
    address public immutable tokenB;
    uint256 public feeBps; // fee in basis points (e.g. 100 = 1%)
    uint256 public constant BPS = 10000;

    constructor(address _tokenA, address _tokenB, uint256 _feeBps) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid tokens");
        require(_tokenA != _tokenB, "Same token");
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeBps = _feeBps == 0 ? 100 : _feeBps; // default 1%
    }

    /**
     * @dev Swap tokenIn for tokenOut. User must approve this contract for tokenIn.
     * @param _tokenIn ERC20 address (must be tokenA or tokenB).
     * @param _tokenOut ERC20 address (the other token).
     * @param _amountIn Amount to swap (in token's decimals).
     */
    function swap(address _tokenIn, address _tokenOut, uint256 _amountIn) external nonReentrant returns (uint256 amountOut, uint256 fee) {
        require(
            (_tokenIn == tokenA && _tokenOut == tokenB) || (_tokenIn == tokenB && _tokenOut == tokenA),
            "Invalid token pair"
        );
        require(_amountIn > 0, "Zero amount");

        fee = (_amountIn * feeBps) / BPS;
        amountOut = _amountIn - fee; // 1:1 minus fee

        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenOut).transfer(msg.sender, amountOut);

        emit Swap(msg.sender, _tokenIn, _tokenOut, _amountIn, amountOut, fee);
    }

    /**
     * @dev Owner can seed liquidity by transferring tokens to this contract (no dedicated function; send directly or use transfer).
     */
}
