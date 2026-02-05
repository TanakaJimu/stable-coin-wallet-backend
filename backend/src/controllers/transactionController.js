import Wallet from "../models/wallet.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";
import transactionService from "../services/transaction.service.js";

/**
 * Transaction Controller
 * Follows SOLID principles:
 * - Single Responsibility: HTTP request/response handling
 * - Dependency Inversion: Depends on service abstraction
 */

/**
 * Get transaction history with filtering and pagination
 * GET /api/transactions
 */
export const getTransactions = asyncHandler(async (req, res) => {
  // Get user's wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    throw ApiError.notFound("Wallet not found. Please create a wallet first.");
  }

  // Extract filters and pagination from query
  const filters = {
    type: req.query.type,
    status: req.query.status,
    asset: req.query.asset,
    network: req.query.network,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  const pagination = {
    page: req.query.page,
    limit: req.query.limit,
  };

  // Get transactions from service
  const result = await transactionService.getTransactions(wallet._id, filters, pagination);

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "TRANSACTIONS_LISTED",
    req,
    meta: { filters, pagination: result.pagination },
  });

  return ApiResponse.paginated(
    res,
    result.items,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total,
    "Transactions retrieved successfully"
  );
});

/**
 * Get transaction by ID
 * GET /api/transactions/:id
 */
export const getTransactionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get user's wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    throw ApiError.notFound("Wallet not found");
  }

  // Get transaction from service
  const transaction = await transactionService.getTransactionById(id, wallet._id);

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "TRANSACTION_VIEWED",
    req,
    entityType: "transaction",
    entityId: transaction._id,
  });

  return ApiResponse.success(res, transaction, "Transaction retrieved successfully");
});

/**
 * Get transaction statistics
 * GET /api/transactions/stats
 */
export const getTransactionStats = asyncHandler(async (req, res) => {
  // Get user's wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    throw ApiError.notFound("Wallet not found");
  }

  // Extract date filters
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  // Get statistics from service
  const stats = await transactionService.getTransactionStats(wallet._id, filters);

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "TRANSACTION_STATS_VIEWED",
    req,
    meta: { filters },
  });

  return ApiResponse.success(res, stats, "Transaction statistics retrieved successfully");
});

/**
 * Update transaction status (admin or system use)
 * PATCH /api/transactions/:id/status
 */
export const updateTransactionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw ApiError.validationError("status is required");
  }

  // Get user's wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    throw ApiError.notFound("Wallet not found");
  }

  // Update transaction status
  const transaction = await transactionService.updateTransactionStatus(id, wallet._id, status);

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "TRANSACTION_STATUS_UPDATED",
    req,
    entityType: "transaction",
    entityId: transaction._id,
    meta: { oldStatus: transaction.status, newStatus: status },
  });

  return ApiResponse.success(res, transaction, "Transaction status updated successfully");
});
