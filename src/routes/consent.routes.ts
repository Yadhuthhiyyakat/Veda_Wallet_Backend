import { Router } from "express";
import {
  requestVerification,
  getPendingRequests,
  respondConsent,
  getRequestStatus,
} from "../controllers/consent.controller";
import { requireWalletAuth } from "../middleware/auth.middleware";

const router = Router();

// Verifier creates a request
router.post("/request", requestVerification);

// Verifier polls request status
router.get("/:requestId/status", getRequestStatus);

// Mobile wallet pending queries and responses
router.use(requireWalletAuth);
router.get("/pending", getPendingRequests);
router.post("/:requestId/respond", respondConsent);

export default router;
