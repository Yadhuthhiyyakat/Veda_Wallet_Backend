import express from "express";
import cors from "cors";

import walletRoutes from "./routes/wallet.routes.js";
import consentRoutes from "./routes/consent.routes.js";
import verifierRoutes from "./routes/verifier.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root & Health check (for Render / cloud load balancers)
app.get(["/", "/health", "/api/health"], (_req, res) => {
  res.json({
    status: "ok",
    service: "VEDA Private Wallet & Verifier Backend (Server B)",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/wallet", walletRoutes);
app.use("/api/consent", consentRoutes);
app.use("/api/verify", verifierRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found on Wallet Gateway" });
});

export default app;
