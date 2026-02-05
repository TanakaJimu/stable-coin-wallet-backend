import express from "express";
import { summary, send } from "../controllers/walletChainController.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/summary", requireAuth, summary);
router.post("/send", requireAuth, send);

export default router;
