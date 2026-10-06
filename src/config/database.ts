import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "bun:sqlite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_WALLET_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_WALLET_SERVICE_ROLE_KEY || process.env.SUPABASE_WALLET_KEY || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export let supabaseWallet: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  supabaseWallet = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  console.log("[Server B Database] Connected to Remote Supabase Wallet DB:", SUPABASE_URL);
} else {
  console.log("[Server B Database] SUPABASE_WALLET_URL not provided. Falling back to local SQLite.");
}

// Local SQLite fallback engine
const dbPath = path.resolve(process.cwd(), "wallet.db");
export const sqliteDb = new Database(dbPath, { create: true });

// Initialize SQLite schema if running in local mode
sqliteDb.run(`
  CREATE TABLE IF NOT EXISTS wallet_users (
    id TEXT PRIMARY KEY,
    veda_handle TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS device_bindings (
    id TEXT PRIMARY KEY,
    wallet_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT DEFAULT 'android',
    status TEXT DEFAULT 'active',
    paired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(wallet_user_id) REFERENCES wallet_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS linked_lockers (
    id TEXT PRIMARY KEY,
    wallet_user_id TEXT NOT NULL,
    locker_provider TEXT DEFAULT 'VEDA_GOV_LOCKER',
    locker_user_id TEXT,
    locker_access_token TEXT,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(wallet_user_id) REFERENCES wallet_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS consent_requests (
    id TEXT PRIMARY KEY,
    wallet_user_id TEXT NOT NULL,
    verifier_name TEXT NOT NULL,
    document_id TEXT,
    document_title TEXT NOT NULL,
    requested_fields TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    disclosed_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(wallet_user_id) REFERENCES wallet_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification_logs (
    id TEXT PRIMARY KEY,
    wallet_user_id TEXT,
    token_verified TEXT NOT NULL,
    status TEXT NOT NULL,
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export const db = sqliteDb;
