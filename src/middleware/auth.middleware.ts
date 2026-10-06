import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "veda_wallet_secret_key_private_co_2026";

export interface AuthenticatedWalletRequest extends Request {
  walletUser?: {
    id: string;
    vedaHandle: string;
    email?: string;
  };
}

export const requireWalletAuth = (
  req: AuthenticatedWalletRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      vedaHandle: string;
      email?: string;
    };
    req.walletUser = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired wallet token" });
  }
};
