// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUniswapRouter.sol";

/**
 * @title Vault
 * @dev Custodial vault: deposit (user), withdrawTo (operator), swap (operator via DEX router).
 */
contract Vault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IUniswapRouter public router;
    address public feeRecipient;
    uint256 public swapFeeBps; // basis points, e.g. 30 = 0.3%

    event Deposited(address indexed user, address indexed token, uint256 amount, string refId);
    event Withdrawn(address indexed token, address indexed to, uint256 amount, string refId);
    event Swapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut, address indexed to);
    event RouterSet(address indexed router);
    event FeeRecipientSet(address indexed feeRecipient);
    event SwapFeeSet(uint256 feeBps);

    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, defaultAdmin);
        feeRecipient = defaultAdmin;
    }

    /**
     * @dev User deposits tokens after approve(vault, amount). Emits Deposited.
     */
    function deposit(address token, uint256 amount, string calldata refId) external nonReentrant {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, token, amount, refId);
    }

    /**
     * @dev Operator withdraws tokens to a recipient. Only OPERATOR_ROLE.
     */
    function withdrawTo(address token, address to, uint256 amount, string calldata refId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount, refId);
    }

    /**
     * @dev Operator swaps via DEX router. Only OPERATOR_ROLE.
     * path[0] = fromToken, path[path.length-1] = toToken.
     */
    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline,
        address[] calldata path
    ) external onlyRole(OPERATOR_ROLE) nonReentrant returns (uint256[] memory amounts) {
        address r = address(router);
        require(r != address(0), "Vault: router not set");
        require(path.length >= 2 && path[0] == fromToken && path[path.length - 1] == toToken, "Vault: invalid path");

        IERC20(fromToken).safeIncreaseAllowance(r, amountIn);
        amounts = IUniswapRouter(r).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );
        uint256 amountOut = amounts[amounts.length - 1];
        if (swapFeeBps > 0 && feeRecipient != address(0)) {
            uint256 fee = (amountOut * swapFeeBps) / 10000;
            if (fee > 0) {
                IERC20(toToken).safeTransfer(feeRecipient, fee);
                amountOut -= fee;
            }
        }
        emit Swapped(fromToken, toToken, amountIn, amountOut, address(this));
        return amounts;
    }

    function setRouter(address _router) external onlyRole(DEFAULT_ADMIN_ROLE) {
        router = IUniswapRouter(_router);
        emit RouterSet(_router);
    }

    function setFeeRecipient(address _feeRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeRecipient = _feeRecipient;
        emit FeeRecipientSet(_feeRecipient);
    }

    function setSwapFeeBps(uint256 _swapFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        swapFeeBps = _swapFeeBps;
        emit SwapFeeSet(_swapFeeBps);
    }

    /**
     * @dev Rescue stuck tokens. Only DEFAULT_ADMIN_ROLE.
     */
    function rescueToken(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        IERC20(token).safeTransfer(to, amount);
    }
}
