import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import Wallet from "../models/wallet.js";
import Balance from "../models/balance.js";
import { SUPPORTED_ASSETS } from "../utils/constants.js";
import {
  listWallets,
  createWallet,
  getSummary,
  getWalletBalance,
  getBalanceByAddress,
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
  let wallet = await Wallet.findOne({ userId, isDefault: true });
  if (!wallet) wallet = await Wallet.findOne({ userId }).sort({ createdAt: 1 });
  if (!wallet) {
    wallet = await Wallet.create({ userId, name: "My Wallet", isDefault: true });
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
 * /api/wallet/create:
 *   post:
 *     summary: Create another wallet
 *     description: Creates a new wallet for the current user. Optional name and isDefault. If this is the user's first wallet or isDefault is true, it becomes the default wallet used by summary/send/topup etc.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Savings
 *                 description: Display name for the wallet
 *               isDefault:
 *                 type: boolean
 *                 default: false
 *                 description: Set as the default wallet for this user
 *     responses:
 *       201:
 *         description: Wallet created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Wallet created
 *                 wallet:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     isDefault:
 *                       type: boolean
 *                     isLocked:
 *                       type: boolean
 *                 balances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Balance'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/create", createWallet);

/**
 * @swagger
 * /api/wallet/summary:
 *   get:
 *     summary: Get wallet summary with balances (off-chain or on-chain)
 *     description: |
 *       Default (off-chain): returns DB ledger balances for default wallet.
 *       On-chain: add query mode=onchain&network=POLYGON_AMOY to fetch ERC20 balances from blockchain.
 *       Requires AMOY_RPC_URL and AMOY_MOCK_USDT/AMOY_MOCK_USDC (and optionally AMOY_MOCK_DAI) in .env for on-chain.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [offchain, onchain]
 *           default: offchain
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           default: POLYGON_AMOY
 *         description: Used when mode=onchain (only POLYGON_AMOY supported)
 *     responses:
 *       200:
 *         description: Wallet summary (off-chain: walletId + balances from DB; on-chain: walletId, mode, network, address, balances from chain)
 *       400:
 *         description: Wallet not found/locked, or (on-chain) unsupported network / no stored address for network
 */
// Postman examples:
//   Off-chain: GET {{baseUrl}}/api/wallet/summary  (Authorization: Bearer <token>)
//   On-chain:  GET {{baseUrl}}/api/wallet/summary?mode=onchain&network=POLYGON_AMOY
router.get("/summary", getSummary);

/**
 * @swagger
 * /api/wallet/balance-by-address:
 *   get:
 *     summary: Get balances by derived address (off-chain or on-chain)
 *     description: Pass address=0x... (required). Default returns DB ledger. Add mode=onchain&network=POLYGON_AMOY to fetch ERC20 balances from chain for that address.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           example: "0x..."
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           example: USDT
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [offchain, onchain]
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           default: POLYGON_AMOY
 *     responses:
 *       200:
 *         description: address, walletId, wallet, balances (or mode/network/balances when onchain)
 *       404:
 *         description: Address not found or not owned by you
 *       401:
 *         description: Unauthorized
 */
router.get("/balance-by-address", getBalanceByAddress);

/**
 * @swagger
 * /api/wallet/{walletId}/balance:
 *   get:
 *     summary: Get balance for a specific wallet (off-chain or on-chain)
 *     description: Default returns DB ledger. Add mode=onchain&network=POLYGON_AMOY to fetch ERC20 balances for this wallet's default address on that network.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           example: USDT
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [offchain, onchain]
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           default: POLYGON_AMOY
 *     responses:
 *       200:
 *         description: walletId, wallet, balances (or + mode, network, address when onchain)
 *       400:
 *         description: (onchain) No stored address for network
 *       404:
 *         description: Wallet not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:walletId/balance", getWalletBalance);

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
 *               fromAddress:
 *                 type: string
 *                 example: "external_wallet_123"
 *                 description: Optional source address / reference for the topup
 *               toAddress:
 *                 type: string
 *                 example: "internal_wallet_or_contract_456"
 *                 description: Optional destination address for the topup
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
