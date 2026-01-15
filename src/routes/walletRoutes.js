import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  getSummary,
  getReceiveAddress,
  topup,
  receive,
  send,
  swap,
  history,
} from "../controllers/walletController.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", getSummary);
router.get("/receive-address", getReceiveAddress);

router.post("/topup", topup);
router.post("/receive", receive);
router.post("/send", send);
router.post("/swap", swap);

router.get("/history", history);

export default router;
