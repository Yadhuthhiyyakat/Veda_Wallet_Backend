import { Request, Response } from "express";
import crypto from "crypto";
import { dbService } from "../services/db.service";

const LOCKER_API_BASE = process.env.LOCKER_API_BASE || "https://vedha-backend-9wy7.onrender.com/api";

// ─── Public QR Verification Scanner Relay ─────────────────────────────────────
export const verifyQRCode = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params as { token: string };

  try {
    // Forward verification to Government Locker public verification endpoint
    const govRes = await fetch(`${LOCKER_API_BASE}/tokens/verify/${token}`);
    const govData = (await govRes.json()) as any;

    const logId = `vlog_${crypto.randomBytes(8).toString("hex")}`;
    const status = govRes.status === 200 ? "verified" : govRes.status === 410 ? "expired" : "failed";

    // Record verification event in Server B's audit database
    await dbService.logVerification({ id: logId, token_verified: token, status });

    res.status(govRes.status).json({
      ...govData,
      network: "VEDA_VERIFIER_SWITCH",
      logged_at: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to verify token: " + err.message });
  }
};
