import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createBeneficiary,
  listBeneficiaries,
  updateBeneficiary,
  deleteBeneficiary,
} from "../controllers/beneficiaryController.js";

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/beneficiary:
 *   get:
 *     summary: List all beneficiaries for the authenticated user
 *     tags: [Beneficiary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *           enum: [USDT, USDC, DAI]
 *         description: Filter by asset type
 *         example: USDT
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *           enum: [TRC20, ERC20, BEP20, SOL]
 *         description: Filter by network
 *         example: TRC20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by nickname or address (case-insensitive)
 *         example: "John"
 *     responses:
 *       200:
 *         description: List of beneficiaries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   nickname:
 *                     type: string
 *                     example: "John's Wallet"
 *                   address:
 *                     type: string
 *                     example: "TXYZ1234567890abcdef"
 *                   asset:
 *                     type: string
 *                     example: USDT
 *                   network:
 *                     type: string
 *                     example: TRC20
 *                   isWhitelisted:
 *                     type: boolean
 *                     example: false
 *                   note:
 *                     type: string
 *                     nullable: true
 *                     example: "Personal wallet"
 *                   lastUsedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", listBeneficiaries);

/**
 * @swagger
 * /api/beneficiary:
 *   post:
 *     summary: Create a new beneficiary
 *     tags: [Beneficiary]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nickname
 *               - address
 *               - asset
 *               - network
 *             properties:
 *               nickname:
 *                 type: string
 *                 maxLength: 40
 *                 description: Friendly name for the beneficiary
 *                 example: "John's Wallet"
 *               address:
 *                 type: string
 *                 maxLength: 120
 *                 description: Wallet address of the beneficiary
 *                 example: "TXYZ1234567890abcdef"
 *               asset:
 *                 type: string
 *                 enum: [USDT, USDC, DAI]
 *                 description: Asset type
 *                 example: USDT
 *               network:
 *                 type: string
 *                 enum: [TRC20, ERC20, BEP20, SOL]
 *                 description: Network type
 *                 example: TRC20
 *               isWhitelisted:
 *                 type: boolean
 *                 default: false
 *                 description: Mark as whitelisted beneficiary
 *                 example: false
 *               note:
 *                 type: string
 *                 maxLength: 120
 *                 description: Optional note about the beneficiary
 *                 example: "Personal wallet for payments"
 *     responses:
 *       201:
 *         description: Beneficiary created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 nickname:
 *                   type: string
 *                 address:
 *                   type: string
 *                 asset:
 *                   type: string
 *                 network:
 *                   type: string
 *                 isWhitelisted:
 *                   type: boolean
 *                 note:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Beneficiary already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", createBeneficiary);

/**
 * @swagger
 * /api/beneficiary/{id}:
 *   patch:
 *     summary: Update a beneficiary
 *     tags: [Beneficiary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Beneficiary ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 maxLength: 40
 *                 description: Update friendly name
 *                 example: "John's Updated Wallet"
 *               note:
 *                 type: string
 *                 maxLength: 120
 *                 description: Update note
 *                 example: "Updated note"
 *               isWhitelisted:
 *                 type: boolean
 *                 description: Update whitelist status
 *                 example: true
 *     responses:
 *       200:
 *         description: Beneficiary updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 nickname:
 *                   type: string
 *                 address:
 *                   type: string
 *                 asset:
 *                   type: string
 *                 network:
 *                   type: string
 *                 isWhitelisted:
 *                   type: boolean
 *                 note:
 *                   type: string
 *                   nullable: true
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Beneficiary not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/:id", updateBeneficiary);

/**
 * @swagger
 * /api/beneficiary/{id}:
 *   delete:
 *     summary: Delete a beneficiary
 *     tags: [Beneficiary]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Beneficiary ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Beneficiary deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Beneficiary not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/:id", deleteBeneficiary);

export default router;
