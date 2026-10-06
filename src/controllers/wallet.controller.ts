import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { dbService } from "../services/db.service";
import { AuthenticatedWalletRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "veda_wallet_secret_key_private_co_2026";
const LOCKER_API_BASE = process.env.LOCKER_API_BASE || "https://vedha-backend-9wy7.onrender.com/api";

// ─── 1. Register or Login to Private Wallet ──────────────────────────────────
export const registerOrLoginWallet = async (req: Request, res: Response): Promise<void> => {
  const { email, phone, full_name, veda_handle } = req.body;

  const identifier = email || phone || veda_handle;
  if (!identifier) {
    res.status(400).json({ error: "Email, phone, or veda_handle is required" });
    return;
  }

  const handle = veda_handle || (email ? `${email.split("@")[0]}@veda` : `user_${Date.now()}@veda`);

  try {
    let existing = await dbService.findUserByIdentifier(handle, email);
    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      userId = `wusr_${crypto.randomBytes(8).toString("hex")}`;
      await dbService.createUser({
        id: userId,
        veda_handle: handle,
        email: email || null,
        phone: phone || null,
        full_name: full_name || "Veda Wallet User",
      });
    }

    const token = jwt.sign(
      { id: userId, vedaHandle: handle, email },
      JWT_SECRET,
      { expiresIn: "90d" }
    );

    res.json({
      message: "Wallet authenticated successfully",
      wallet_token: token,
      wallet_user: {
        id: userId,
        veda_handle: handle,
        email,
        full_name: full_name || "Veda Wallet User",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Database error: " + err.message });
  }
};

// ─── 2. Hardware Device Binding (Like UPI SIM/Device Handshake) ─────────────
export const bindDevice = async (req: AuthenticatedWalletRequest, res: Response): Promise<void> => {
  const userId = req.walletUser!.id;
  const { device_id, device_name, platform = "android" } = req.body;

  if (!device_id) {
    res.status(400).json({ error: "device_id is required" });
    return;
  }

  try {
    const bindId = `bind_${crypto.randomBytes(8).toString("hex")}`;
    await dbService.bindDevice({
      id: bindId,
      wallet_user_id: userId,
      device_id,
      device_name: device_name || "Mobile Device",
      platform,
    });

    res.json({
      message: "Hardware device bound successfully",
      binding_id: bindId,
      device_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Binding error: " + err.message });
  }
};

// ─── 3. Link with Government Cloud Locker (Bank-to-UPI Bridge) ───────────────
export const linkGovLocker = async (req: AuthenticatedWalletRequest, res: Response): Promise<void> => {
  const userId = req.walletUser!.id;
  const { pair_token } = req.body;

  if (!pair_token) {
    res.status(400).json({ error: "pair_token is required" });
    return;
  }

  try {
    // Handshake with Government/Bank Locker (Server A)
    const lockerRes = await fetch(`${LOCKER_API_BASE}/auth/pair-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pair_token,
        token: pair_token,
        device_name: "VEDA Private Wallet App",
      }),
    });

    const lockerData = (await lockerRes.json()) as any;
    if (!lockerRes.ok || !lockerData.access_token) {
      res.status(lockerRes.status).json({
        error: lockerData.error || "Failed to link with Government Locker",
      });
      return;
    }

    const linkId = `link_${crypto.randomBytes(8).toString("hex")}`;
    await dbService.linkLocker({
      id: linkId,
      wallet_user_id: userId,
      locker_provider: "VEDA_GOV_LOCKER",
      locker_user_id: lockerData.user?.id || "gov_user",
      locker_access_token: lockerData.access_token,
    });

    res.json({
      message: "Government Cloud Locker linked successfully to VEDA Wallet",
      linked_locker_id: linkId,
      gov_user: lockerData.user,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to connect to Government Locker: " + err.message });
  }
};

// ─── 4. Fetch Lightweight Verifiable Cards from Linked Locker ───────────────
export const getWalletCards = async (req: AuthenticatedWalletRequest, res: Response): Promise<void> => {
  const userId = req.walletUser!.id;

  try {
    const locker = await dbService.getLatestLinkedLocker(userId);

    if (!locker || !locker.locker_access_token) {
      res.status(404).json({
        error: "No Government Locker linked yet. Please scan your Web Locker QR.",
        cards: [],
      });
      return;
    }

    // Request documents from Server A using stored locker bearer token
    const govDocsRes = await fetch(`${LOCKER_API_BASE}/documents`, {
      headers: {
        Authorization: `Bearer ${locker.locker_access_token}`,
      },
    });

    if (!govDocsRes.ok) {
      res.status(govDocsRes.status).json({ error: "Locker token expired or invalid" });
      return;
    }

    const docs = (await govDocsRes.json()) as any[];

    // Transform heavy vault files into lightweight, verifiable credential cards
    const cards = (Array.isArray(docs) ? docs : []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category || "General",
      subcategory: doc.subcategory || "Official",
      status: doc.status || "verified",
      issuer: "Government of India / VEDA Sovereign Vault",
      is_cached_for_offline: true,
      expiry_date: doc.expiry_date,
      document_data: doc.document_data || {},
    }));

    res.json({
      cards,
      total: cards.length,
      wallet_id: userId,
      veda_handle: req.walletUser!.vedaHandle,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error contacting Government Locker: " + err.message });
  }
};
