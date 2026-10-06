import { Request, Response } from "express";
import crypto from "crypto";
import { dbService } from "../services/db.service.js";
import { AuthenticatedWalletRequest } from "../middleware/auth.middleware.js";

// ─── 1. Verifier Creates a UPI Collect Verification Request ──────────────────
export const requestVerification = async (req: Request, res: Response): Promise<void> => {
  const {
    veda_handle,
    document_title,
    requested_fields = [],
    verifier_name = "Third-Party Verifier",
    reason = "Identity Verification",
    expires_in_minutes = 10,
  } = req.body;

  if (!veda_handle || !document_title) {
    res.status(400).json({ error: "veda_handle and document_title are required" });
    return;
  }

  try {
    // Lookup target wallet user
    const user = await dbService.findUserByIdentifier(veda_handle);
    if (!user) {
      res.status(404).json({ error: `VEDA handle '${veda_handle}' not found on VEDA Wallet Network` });
      return;
    }

    const reqId = `vreq_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expires_in_minutes * 60 * 1000).toISOString();

    await dbService.createConsentRequest({
      id: reqId,
      wallet_user_id: user.id,
      verifier_name,
      document_title,
      requested_fields: JSON.stringify(requested_fields),
      reason,
      status: "pending",
      expires_at: expiresAt,
    });

    res.status(201).json({
      message: "Consent verification request pushed to user's mobile wallet",
      request_id: reqId,
      veda_handle,
      status: "pending",
      expires_at: expiresAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to push verification request: " + err.message });
  }
};

// ─── 2. Mobile App Polls Pending Collect Requests ────────────────────────────
export const getPendingRequests = async (req: AuthenticatedWalletRequest, res: Response): Promise<void> => {
  const userId = req.walletUser!.id;
  const nowIso = new Date().toISOString();

  try {
    const rows = await dbService.getPendingConsentRequests(userId, nowIso);

    const requests = rows.map((r) => {
      let fields = [];
      try {
        fields = typeof r.requested_fields === "string" ? JSON.parse(r.requested_fields) : r.requested_fields;
      } catch {
        fields = [];
      }

      return {
        id: r.id,
        verifier_name: r.verifier_name,
        document_title: r.document_title,
        requested_fields: fields,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
        expires_at: r.expires_at,
      };
    });

    res.json({ requests, count: requests.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pending requests: " + err.message });
  }
};

// ─── 3. Mobile App Responds (Biometric Approve or Decline) ───────────────────
export const respondConsent = async (req: AuthenticatedWalletRequest, res: Response): Promise<void> => {
  const userId = req.walletUser!.id;
  const { requestId } = req.params as { requestId: string };
  const { action, disclosed_data } = req.body;

  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    return;
  }

  try {
    const existing = await dbService.getConsentRequestById(requestId, userId);

    if (!existing) {
      res.status(404).json({ error: "Verification request not found" });
      return;
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    await dbService.updateConsentRequest(
      requestId,
      newStatus,
      disclosed_data ? JSON.stringify(disclosed_data) : null
    );

    res.json({
      message: action === "approve" ? "Biometric consent granted" : "Consent declined",
      status: newStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process consent response: " + err.message });
  }
};

// ─── 4. Verifier Polls Status of Request ─────────────────────────────────────
export const getRequestStatus = async (req: Request, res: Response): Promise<void> => {
  const { requestId } = req.params as { requestId: string };

  try {
    const row = await dbService.getConsentRequestById(requestId);
    if (!row) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    let disclosed = null;
    if (row.disclosed_data) {
      try {
        disclosed = typeof row.disclosed_data === "string" ? JSON.parse(row.disclosed_data) : row.disclosed_data;
      } catch {
        disclosed = row.disclosed_data;
      }
    }

    res.json({
      id: row.id,
      verifier_name: row.verifier_name,
      document_title: row.document_title,
      status: row.status,
      disclosed_data: disclosed,
      expires_at: row.expires_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch request status: " + err.message });
  }
};
