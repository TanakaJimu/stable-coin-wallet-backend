import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  importMnemonic,
  deriveAddress,
  generateAddress,
  listAddresses,
  getDefaultAddress,
  setDefault,
  deleteAddress,
} from "../controllers/addressController.js";

const router = Router();
router.use(requireAuth);

router.post("/import-mnemonic", importMnemonic);
router.post("/derive", deriveAddress);
router.post("/generate", generateAddress); // alias for derive
router.get("/", listAddresses);
router.get("/default", getDefaultAddress);
router.patch("/:id/default", setDefault);
router.delete("/:id", deleteAddress);

export default router;
