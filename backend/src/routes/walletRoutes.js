import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import Wallet from "../models/wallet.js";
import Balance from "../models/balance.js";
import { SUPPORTED_ASSETS } from "../utils/constants.js";
import {
  listWallets,
  getSummary,
  getReceiveAddress,
  addAsset,
  topup,
  receive,
  send,
  swap,
  history,
} from "../controllers/walletController.js";

const router = Router();
router.use(requireAuth);

async function ensureWalletAndBalances(userId) {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId });
  }

  await Promise.all(
    SUPPORTED_ASSETS.map((asset) =>
      Balance.updateOne(
        { walletId: wallet._id, asset },
        { $setOnInsert: { available: 0, locked: 0 } },
        { upsert: true }
      )
    )
  );

  return wallet;
}

// Guarantee wallet + balances exist for any wallet route (helps older accounts)
router.use(async (req, res, next) => {
  try {
    await ensureWalletAndBalances(req.user.id);
    next();
  } catch (err) {
    console.error("ensureWalletAndBalances failed:", err);
    res.status(500).json({ message: "Wallet setup failed" });
  }
});

/**
 * @swagger
 * /api/wallet/listWallets:
 *   get:
 *     summary: List wallets (paginated)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of wallets per page
 *     responses:
 *       200:
 *         description: List of wallets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       defaultFiat:
 *                         type: string
 *                       isLocked:
 *                         type: boolean
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/listWallets", listWallets);

/**
 * @swagger
 * /api/wallet/summary:
 *   get:
 *     summary: Get wallet summary with balances
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletSummary'
 *       400:
 *         description: Wallet not found or locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/summary", getSummary);

/**
 * @swagger
 * /api/wallet/add-asset:
 *   post:
 *     summary: Add a wallet balance for another supported asset
 *     description: Lets the user add a new currency/asset to their wallet (e.g. EUR). Asset must be one of USD, USDT, USDC, DAI, EUR. If the balance already exists, returns it.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset]
 *             properties:
 *               asset:
 *                 type: string
 *                 example: EUR
 *                 description: Asset code (USD, USDT, USDC, DAI, EUR)
 *     responses:
 *       201:
 *         description: Wallet balance added
 *       200:
 *         description: Balance already exists for this asset
 *       400:
 *         description: Missing asset or unsupported asset
 */
router.post("/add-asset", addAsset);

/**
 * @swagger
 * /api/wallet/receive-address:
 *   get:
 *     summary: Get or generate receive address for a specific asset and network
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           default: USDT
 *           enum: [USDT, USDC]
 *         description: Asset code
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           default: TRC20
 *           enum: [TRC20, ERC20]
 *         description: Network
 *     responses:
 *       200:
 *         description: Receive address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 walletId:
 *                   type: string
 *                 asset:
 *                   type: string
 *                 network:
 *                   type: string
 *                 address:
 *                   type: string
 *                 isDefault:
 *                   type: boolean
 *       400:
 *         description: Unsupported asset/network or wallet error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/receive-address", getReceiveAddress);

/**
 * @swagger
 * /api/wallet/topup:
 *   post:
 *     summary: Top up wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *               - amount
 *             properties:
 *               asset:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 example: USDT
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 100.50
 *               network:
 *                 type: string
 *                 enum: [TRC20, ERC20]
 *                 default: TRC20
 *                 example: TRC20
 *               reference:
 *                 type: string
 *                 example: "tx_ref_12345"
 *     responses:
 *       201:
 *         description: Top up successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   $ref: '#/components/schemas/Balance'
 *                 tx:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid request or wallet error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/topup", topup);

/**
 * @swagger
 * /api/wallet/receive:
 *   post:
 *     summary: Receive funds (manual credit endpoint)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *               - amount
 *             properties:
 *               asset:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 example: USDT
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 50.00
 *               network:
 *                 type: string
 *                 enum: [TRC20, ERC20]
 *                 default: TRC20
 *                 example: TRC20
 *               fromAddress:
 *                 type: string
 *                 example: "TXYZ1234567890abcdef"
 *               memo:
 *                 type: string
 *                 example: "Payment for services"
 *               reference:
 *                 type: string
 *                 example: "tx_ref_67890"
 *     responses:
 *       201:
 *         description: Funds received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   $ref: '#/components/schemas/Balance'
 *                 tx:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid request or wallet error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/receive", receive);

/**
 * @swagger
 * /api/wallet/send:
 *   post:
 *     summary: Send funds to an address
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *               - amount
 *               - toAddress
 *             properties:
 *               asset:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 example: USDT
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 25.00
 *               network:
 *                 type: string
 *                 enum: [TRC20, ERC20]
 *                 default: TRC20
 *                 example: TRC20
 *               toAddress:
 *                 type: string
 *                 example: "TXYZ9876543210fedcba"
 *               memo:
 *                 type: string
 *                 example: "Payment for goods"
 *               fee:
 *                 type: number
 *                 default: 0
 *                 minimum: 0
 *                 example: 1.00
 *     responses:
 *       201:
 *         description: Funds sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   $ref: '#/components/schemas/Balance'
 *                 tx:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid request, insufficient balance, or wallet error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Balance not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/send", send);

/**
 * @swagger
 * /api/wallet/swap:
 *   post:
 *     summary: Swap one asset for another
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAsset
 *               - toAsset
 *               - amount
 *             properties:
 *               fromAsset:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 example: USDT
 *               toAsset:
 *                 type: string
 *                 enum: [USDT, USDC]
 *                 example: USDC
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 100.00
 *               rate:
 *                 type: number
 *                 default: 1.0
 *                 minimum: 0.0001
 *                 example: 1.0
 *               fee:
 *                 type: number
 *                 default: 0
 *                 minimum: 0
 *                 example: 0.50
 *     responses:
 *       201:
 *         description: Swap completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fromBalance:
 *                   $ref: '#/components/schemas/Balance'
 *                 toBalance:
 *                   $ref: '#/components/schemas/Balance'
 *                 tx:
 *                   $ref: '#/components/schemas/Transaction'
 *                 credited:
 *                   type: number
 *                   description: Amount credited to destination asset
 *       400:
 *         description: Invalid request, insufficient balance, or same assets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Balance not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/swap", swap);

/**
 * @swagger
 * /api/wallet/history:
 *   get:
 *     summary: Get transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Wallet error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/history", history);

export default router;
