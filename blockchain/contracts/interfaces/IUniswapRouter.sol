// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUniswapRouter
 * @notice Minimal interface for Uniswap V2 / compatible DEX router (swapExactTokensForTokens).
 * Use the router address for the chain you deploy to (e.g. Uniswap V2, QuickSwap, SushiSwap).
 */
interface IUniswapRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}
