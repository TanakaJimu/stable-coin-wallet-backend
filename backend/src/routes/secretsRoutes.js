import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createSecrets,
  readSecrets,
  readDecryptedSecrets,
  updateSecrets,
  deleteSecrets,
  generateCustodialAddress,
  listCustodialSecrets,
  getSecretById,
  readDecryptedStrict,
  deleteSecretById,
} from "../controllers/secretsController.js";

const router = Router();

// All secrets routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/secrets/createSecrets:
 *   post:
 *     summary: Generate a new custodial address (server creates address and encrypted key)
 *     description: Creates a new Ethereum-style address via ethers; private key is encrypted and stored. Do NOT send userAddress or privateKey — the server generates the address.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Only these fields; walletId is determined by the backend (default wallet).
 *             properties:
 *               network:
 *                 type: string
 *                 default: "POLYGON_AMOY"
 *                 example: "POLYGON_AMOY"
 *               asset:
 *                 type: string
 *                 example: "USDT"
 *               label:
 *                 type: string
 *                 example: "deposit-1"
 *               setDefault:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: New custodial address generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 secretId:
 *                   type: string
 *                 address:
 *                   type: string
 *                 walletId:
 *                   type: string
 *                 network:
 *                   type: string
 *                 asset:
 *                   type: string
 *                   nullable: true
 *                   example: "USDT"
 *                 default:
 *                   type: boolean
 *                   description: Whether this address is the default for the wallet
 *                 isCustodial:
 *                   type: boolean
 *       400:
 *         description: Validation error (e.g. do not send userAddress/privateKey)
 *       401:
 *         description: Unauthorized
 */
router.post("/createSecrets", createSecrets);

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

// ---------- Custodial (server-generated) address API ----------
router.post("/generate", generateCustodialAddress);
router.get("/", listCustodialSecrets);
router.get("/:id", getSecretById);
router.post("/read-decrypted", readDecryptedStrict);
router.delete("/:id", deleteSecretById);

export default router;

