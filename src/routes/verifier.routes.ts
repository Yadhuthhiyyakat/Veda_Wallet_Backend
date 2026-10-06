import { Router } from "express";
import { verifyQRCode } from "../controllers/verifier.controller.js";

const router = Router();

// GET /api/verify/:token — Public QR scanner verification relay
router.get("/:token", verifyQRCode);

export default router;
