import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createSecrets,
  readSecrets,
  readDecryptedSecrets,
  updateSecrets,
  deleteSecrets,
} from "../controllers/secretsController.js";

const router = Router();

// All secrets routes require authentication
router.use(requireAuth);

/**
 * @swagger
 * /api/secrets/createSecrets:
 *   post:
 *     summary: Create user secrets (store address and private key encrypted)
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *               - privateKey
 *             properties:
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: User's Ethereum wallet address
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *               privateKey:
 *                 type: string
 *                 description: User's private key (will be encrypted before storage)
 *                 example: "0x..."
 *               network:
 *                 type: string
 *                 default: "polygon"
 *                 description: Blockchain network
 *                 example: "polygon"
 *               label:
 *                 type: string
 *                 description: Optional label for this secret
 *                 example: "My Main Wallet"
 *     responses:
 *       201:
 *         description: Secrets created successfully
 *       400:
 *         description: Validation error
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

export default router;

