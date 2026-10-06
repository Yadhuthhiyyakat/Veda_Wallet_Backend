import { Router } from "express";
import {
  registerOrLoginWallet,
  bindDevice,
  linkGovLocker,
  getWalletCards,
} from "../controllers/wallet.controller.js";
import { requireWalletAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Public: Wallet login/registration
router.post("/auth", registerOrLoginWallet);

// Protected: Device-bound operations
router.use(requireWalletAuth);
router.post("/bind-device", bindDevice);
router.post("/link-locker", linkGovLocker);
router.get("/cards", getWalletCards);

export default router;
