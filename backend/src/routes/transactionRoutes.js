import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import Wallet from "../models/wallet.js";
import {
  getTransactions,
  getTransactionById,
  getTransactionStats,
  updateTransactionStatus,
} from "../controllers/transactionController.js";

const router = Router();

// All transaction routes require authentication
router.use(requireAuth);

// Ensure wallet exists middleware
router.use(async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    req.wallet = wallet;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify wallet" });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transaction history with filtering and pagination
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *         description: Number of transactions per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [TOPUP, SEND, RECEIVE, SWAP]
 *         description: Filter by transaction type
 *         example: SEND
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED]
 *         description: Filter by transaction status
 *         example: COMPLETED
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           enum: [USDT, USDC, DAI]
 *         description: Filter by asset
 *         example: USDT
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           enum: [TRC20, ERC20, BEP20, SOL]
 *         description: Filter by network
 *         example: TRC20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for date range filter
 *         example: "2024-01-01T00:00:00.000Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for date range filter
 *         example: "2024-01-31T23:59:59.999Z"
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transactions retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", getTransactions);

/**
 * @swagger
 * /api/transactions/stats:
 *   get:
 *     summary: Get transaction statistics for user's wallet
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics period
 *         example: "2024-01-01T00:00:00.000Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics period
 *         example: "2024-01-31T23:59:59.999Z"
 *     responses:
 *       200:
 *         description: Transaction statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transaction statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTransactions:
 *                       type: integer
 *                     totalVolume:
 *                       type: number
 *                     totalFees:
 *                       type: number
 *                     byType:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           volume:
 *                             type: number
 *                           completed:
 *                             type: integer
 *                           failed:
 *                             type: integer
 *                     byStatus:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     byAsset:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           volume:
 *                             type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wallet not found
 */
router.get("/stats", getTransactionStats);

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transaction retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", getTransactionById);

/**
 * @swagger
 * /api/transactions/{id}/status:
 *   patch:
 *     summary: Update transaction status
 *     tags: [Transaction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, FAILED]
 *                 description: New transaction status
 *                 example: COMPLETED
 *     responses:
 *       200:
 *         description: Transaction status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Transaction status updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid status or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */
router.patch("/:id/status", updateTransactionStatus);

export default router;

