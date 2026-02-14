import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  readSecrets,
  readDecryptedSecrets,
  updateSecrets,
  deleteSecrets,
  readDecryptedStrict,
  initMnemonic,
  deriveAddress,
  listAddresses,
} from "../controllers/secretsController.js";

const router = Router();

// All secrets routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/secrets/readSecrets:
 *   get:
 *     summary: Read user secrets (address only, no private key)
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secrets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userAddress:
 *                       type: string
 *                     network:
 *                       type: string
 *                     label:
 *                       type: string
 *       404:
 *         description: Secrets not found
 *       401:
 *         description: Unauthorized
 */
router.get("/readSecrets", readSecrets);

/**
 * @swagger
 * /api/secrets/readDecryptedSecrets:
 *   get:
 *     summary: Read decrypted secrets including private key (use with caution)
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Decrypted secrets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userAddress:
 *                       type: string
 *                     privateKey:
 *                       type: string
 *                       description: Decrypted private key
 *                     network:
 *                       type: string
 *                     label:
 *                       type: string
 *       404:
 *         description: Secrets not found
 *       401:
 *         description: Unauthorized
 */
router.get("/readDecryptedSecrets", readDecryptedSecrets);

/**
 * @swagger
 * /api/secrets/updateSecrets:
 *   put:
 *     summary: Update user secrets
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Updated user address
 *               privateKey:
 *                 type: string
 *                 description: Updated private key (will be encrypted)
 *               network:
 *                 type: string
 *                 description: Updated network
 *               label:
 *                 type: string
 *                 description: Updated label
 *     responses:
 *       200:
 *         description: Secrets updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Secrets not found
 *       401:
 *         description: Unauthorized
 */
router.put("/updateSecrets", updateSecrets);

/**
 * @swagger
 * /api/secrets/deleteSecrets:
 *   delete:
 *     summary: Delete user secrets
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secrets deleted successfully
 *       404:
 *         description: Secrets not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/deleteSecrets", deleteSecrets);

/**
 * @swagger
 * /api/secrets/read-decrypted:
 *   post:
 *     summary: HD Wallet — return private key for derived address (from mnemonic via HDNodeWallet)
 *     description: Body { address }. Requires x-confirm true header. Rate limited. Key is derived from stored mnemonic, not stored.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address]
 *             properties:
 *               address:
 *                 type: string
 *                 description: HD-derived address (key derived from mnemonic via HDNodeWallet)
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: address and privateKey
 *       403:
 *         description: Missing confirmation or rate limited
 *       404:
 *         description: Address not found or not HD-derived
 *       503:
 *         description: MASTER_KEY not set
 *       401:
 *         description: Unauthorized
 */
router.post("/read-decrypted", readDecryptedStrict);

// ---------- HD Wallet (mnemonic / derived addresses) ----------

/**
 * @swagger
 * /api/secrets/init-mnemonic:
 *   post:
 *     summary: HD Wallet — ensure user has mnemonic (create if missing)
 *     description: One encrypted mnemonic per user. Never returns mnemonic. Requires MASTER_KEY.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               network:
 *                 type: string
 *                 default: "POLYGON_AMOY"
 *     responses:
 *       200:
 *         description: Mnemonic ready; returns hasMnemonic, network, walletId
 *       503:
 *         description: MASTER_KEY not set in .env
 *       401:
 *         description: Unauthorized
 */
router.post("/init-mnemonic", initMnemonic);

/**
 * @swagger
 * /api/secrets/derive-address:
 *   post:
 *     summary: HD Wallet — derive next address, store in WalletAddress
 *     description: Derives at m/44'/60'/0'/0/{index}. Call init-mnemonic first if needed.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               network:
 *                 type: string
 *                 default: "POLYGON_AMOY"
 *               asset:
 *                 type: string
 *                 default: "USDT"
 *               label:
 *                 type: string
 *               setDefault:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Address derived; returns address, index, walletId, network, asset, default, isCustodial
 *       400:
 *         description: No mnemonic — call init-mnemonic first
 *       503:
 *         description: MASTER_KEY not set in .env
 *       401:
 *         description: Unauthorized
 */
router.post("/derive-address", deriveAddress);

/**
 * @swagger
 * /api/secrets/addresses:
 *   get:
 *     summary: HD Wallet — list stored derived addresses
 *     description: Returns address metadata only (no mnemonic, no private key). Optional query filters.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           example: POLYGON_AMOY
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           example: USDT
 *     responses:
 *       200:
 *         description: Array of address, index, asset, network, label, isDefault, createdAt
 *       401:
 *         description: Unauthorized
 */
router.get("/addresses", listAddresses);

export default router;

