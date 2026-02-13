import express from "express";
import { getMintInfo, mint } from "../controllers/nftController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

/**
 * @openapi
 * /nft/info:
 *   get:
 *     tags:
 *       - NFT
 *     summary: Get NFT mint info
 *     description: Returns WalletNFT mint price, total minted, max supply, and whether public mint is active.
 *     responses:
 *       200:
 *         description: Mint info
 *       500:
 *         description: Server error
 */
router.get("/info", getMintInfo);

/**
 * @openapi
 * /nft/mint:
 *   post:
 *     tags:
 *       - NFT
 *     summary: Mint Wallet NFT (on-chain or backend)
 *     description: |
 *       Two modes:
 *       - On-chain: Send { txHash }. User mints from MetaMask; backend verifies the tx and records the mint. Response includes mode "onchain".
 *       - Backend: Send { tokenUri, toAddress? }. Backend signer mints and optionally transfers. Response includes mode "backend".
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tokenUri:
 *                 type: string
 *                 description: Metadata URI (required for backend mint)
 *               toAddress:
 *                 type: string
 *                 description: Optional. For backend mint, transfer NFT to this address after minting.
 *               txHash:
 *                 type: string
 *                 description: For on-chain mode; transaction hash of the user's mint tx.
 *     responses:
 *       200:
 *         description: Mint success
 *       201:
 *         description: On-chain mint recorded
 *       400:
 *         description: Missing tokenUri (backend) or verification failed (on-chain)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Mint recipient does not belong to this user (on-chain)
 *       409:
 *         description: Transaction already processed (on-chain)
 *       500:
 *         description: Server error
 */
router.post("/mint", requireAuth, mint);

export default router;
