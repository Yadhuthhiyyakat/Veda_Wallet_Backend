import { Router } from "express";
import {
  sendWalletOtp,
  verifyWalletOtp,
  registerOrLoginWallet,
  bindDevice,
  linkGovLocker,
  getWalletCards,
} from "../controllers/wallet.controller";
import { requireWalletAuth } from "../middleware/auth.middleware";

const router = Router();

// Public: Email OTP authentication
router.post("/send-otp", sendWalletOtp);
router.post("/verify-otp", verifyWalletOtp);

// Public: Wallet login/registration
router.post("/auth", registerOrLoginWallet);

// Protected: Device-bound operations
router.use(requireWalletAuth);
router.post("/bind-device", bindDevice);
router.post("/link-locker", linkGovLocker);
router.get("/cards", getWalletCards);

export default router;
