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
 *     summary: Mint Wallet NFT
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenUri
 *             properties:
 *               tokenUri:
 *                 type: string
 *                 description: Metadata URI for the token
 *               toAddress:
 *                 type: string
 *                 description: Optional. If set, NFT is transferred to this address after minting.
 *     responses:
 *       200:
 *         description: Mint success
 *       400:
 *         description: Missing or invalid tokenUri
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/mint", requireAuth, mint);

export default router;
