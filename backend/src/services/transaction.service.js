import Transaction from "../models/transaction.js";
import Wallet from "../models/wallet.js";
import { TX_TYPES, TX_STATUS } from "../utils/constants.js";

/**
 * Transaction Service
 * Follows SOLID principles:
 * - Single Responsibility: Transaction business logic
 * - Dependency Inversion: Depends on model abstractions
 * - Open/Closed: Extensible for new transaction types
 */
class TransactionService {
  /**
   * Get transactions for a wallet with filtering and pagination
   * @param {string} walletId - Wallet ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Transactions and pagination info
   */
  async getTransactions(walletId, filters = {}, pagination = {}) {
    try {
      // Verify wallet exists
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new Error("Wallet not found");
      }

      // Build query
      const query = { walletId };

      // Apply filters
      if (filters.type && TX_TYPES.includes(filters.type.toUpperCase())) {
        query.type = filters.type.toUpperCase();
      }

      if (filters.status && TX_STATUS.includes(filters.status.toUpperCase())) {
        query.status = filters.status.toUpperCase();
      }

      if (filters.asset) {
        query.asset = String(filters.asset).toUpperCase();
      }

      if (filters.network) {
        query.network = String(filters.network).toUpperCase();
      }

      // Date range filtering
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      // Pagination
      const page = Math.max(1, Number(pagination.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 30));
      const skip = (page - 1) * limit;

      // Execute query
      const [items, total] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(query),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @param {string} walletId - Wallet ID (for security verification)
   * @returns {Promise<Object>} Transaction document
   */
  async getTransactionById(transactionId, walletId) {
    try {
      const transaction = await Transaction.findOne({
        _id: transactionId,
        walletId,
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      return transaction;
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction statistics for a wallet
   * @param {string} walletId - Wallet ID
   * @param {Object} filters - Optional date range filters
   * @returns {Promise<Object>} Transaction statistics
   */
  async getTransactionStats(walletId, filters = {}) {
    try {
      // Verify wallet exists
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new Error("Wallet not found");
      }

      // Build base query
      const query = { walletId };

      // Date range filtering
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      // Aggregate statistics
      const stats = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalVolume: { $sum: "$amount" },
            totalFees: { $sum: "$fee" },
            byType: {
              $push: {
                type: "$type",
                amount: "$amount",
                status: "$status",
              },
            },
            byStatus: {
              $push: "$status",
            },
            byAsset: {
              $push: {
                asset: "$asset",
                amount: "$amount",
              },
            },
          },
        },
      ]);

      if (stats.length === 0) {
        return {
          totalTransactions: 0,
          totalVolume: 0,
          totalFees: 0,
          byType: {},
          byStatus: {},
          byAsset: {},
        };
      }

      const result = stats[0];

      // Process by type
      const byType = {};
      result.byType.forEach((tx) => {
        if (!byType[tx.type]) {
          byType[tx.type] = { count: 0, volume: 0, completed: 0, failed: 0 };
        }
        byType[tx.type].count++;
        byType[tx.type].volume += tx.amount || 0;
        if (tx.status === "COMPLETED") byType[tx.type].completed++;
        if (tx.status === "FAILED") byType[tx.type].failed++;
      });

      // Process by status
      const byStatus = {};
      result.byStatus.forEach((status) => {
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      // Process by asset
      const byAsset = {};
      result.byAsset.forEach((item) => {
        if (item.asset) {
          if (!byAsset[item.asset]) {
            byAsset[item.asset] = { count: 0, volume: 0 };
          }
          byAsset[item.asset].count++;
          byAsset[item.asset].volume += item.amount || 0;
        }
      });

      return {
        totalTransactions: result.totalTransactions,
        totalVolume: result.totalVolume,
        totalFees: result.totalFees,
        byType,
        byStatus,
        byAsset,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction stats: ${error.message}`);
    }
  }

  /**
   * Create a transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    try {
      // Validate transaction type
      if (!TX_TYPES.includes(transactionData.type?.toUpperCase())) {
        throw new Error(`Invalid transaction type. Must be one of: ${TX_TYPES.join(", ")}`);
      }

      // Validate status
      if (transactionData.status && !TX_STATUS.includes(transactionData.status.toUpperCase())) {
        throw new Error(`Invalid transaction status. Must be one of: ${TX_STATUS.join(", ")}`);
      }

      const transaction = await Transaction.create({
        walletId: transactionData.walletId,
        type: transactionData.type.toUpperCase(),
        status: transactionData.status?.toUpperCase() || "COMPLETED",
        asset: transactionData.asset?.toUpperCase(),
        network: transactionData.network?.toUpperCase(),
        amount: transactionData.amount,
        fromAddress: transactionData.fromAddress,
        toAddress: transactionData.toAddress,
        memo: transactionData.memo,
        fromAsset: transactionData.fromAsset?.toUpperCase(),
        toAsset: transactionData.toAsset?.toUpperCase(),
        rate: transactionData.rate,
        fee: transactionData.fee || 0,
        reference: transactionData.reference,
      });

      return transaction;
    } catch (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  /**
   * Update transaction status
   * @param {string} transactionId - Transaction ID
   * @param {string} walletId - Wallet ID (for security)
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionStatus(transactionId, walletId, status) {
    try {
      if (!TX_STATUS.includes(status.toUpperCase())) {
        throw new Error(`Invalid status. Must be one of: ${TX_STATUS.join(", ")}`);
      }

      const transaction = await Transaction.findOneAndUpdate(
        { _id: transactionId, walletId },
        { status: status.toUpperCase() },
        { new: true }
      );

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      return transaction;
    } catch (error) {
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new TransactionService();

