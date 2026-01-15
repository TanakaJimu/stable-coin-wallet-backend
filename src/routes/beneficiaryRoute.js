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

router.get("/", listBeneficiaries);
router.post("/", createBeneficiary);
router.patch("/:id", updateBeneficiary);
router.delete("/:id", deleteBeneficiary);

export default router;
