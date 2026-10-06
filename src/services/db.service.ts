import { isSupabaseConfigured, supabaseWallet, sqliteDb } from "../config/database";

export interface WalletUserRecord {
  id: string;
  veda_handle: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  created_at?: string;
}

export interface LinkedLockerRecord {
  id: string;
  wallet_user_id: string;
  locker_provider: string;
  locker_user_id: string | null;
  locker_access_token: string | null;
  linked_at?: string;
}

export interface ConsentRequestRecord {
  id: string;
  wallet_user_id: string;
  verifier_name: string;
  document_id?: string | null;
  document_title: string;
  requested_fields: string; // JSON string
  reason?: string | null;
  status: string;
  disclosed_data?: string | null;
  created_at?: string;
  expires_at: string;
}

class WalletDatabaseService {
  // ─── Wallet User Operations ────────────────────────────────────────────────
  async findUserByIdentifier(handle: string, email?: string): Promise<WalletUserRecord | null> {
    if (isSupabaseConfigured && supabaseWallet) {
      let query = supabaseWallet.from("wallet_users").select("*");
      if (email) {
        query = query.or(`veda_handle.eq.${handle},email.eq.${email}`);
      } else {
        query = query.eq("veda_handle", handle);
      }
      const { data, error } = await query.limit(1);
      if (error) {
        console.error("[DB Service] Supabase error findUser:", error.message);
        return null;
      }
      return data && data.length > 0 ? (data[0] as WalletUserRecord) : null;
    }

    // SQLite Fallback
    const user = sqliteDb
      .query("SELECT * FROM wallet_users WHERE veda_handle = ? OR (email IS NOT NULL AND email = ?)")
      .get(handle, email || "") as WalletUserRecord | null;
    return user || null;
  }

  async createUser(user: WalletUserRecord): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { error } = await supabaseWallet.from("wallet_users").insert([user]);
      if (error) {
        console.error("[DB Service] Supabase error createUser:", error.message);
        throw error;
      }
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      "INSERT INTO wallet_users (id, veda_handle, email, phone, full_name) VALUES (?, ?, ?, ?, ?)",
      [user.id, user.veda_handle, user.email || null, user.phone || null, user.full_name || null]
    );
  }

  // ─── Hardware Device Binding ───────────────────────────────────────────────
  async bindDevice(data: {
    id: string;
    wallet_user_id: string;
    device_id: string;
    device_name: string;
    platform: string;
  }): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { error } = await supabaseWallet.from("device_bindings").upsert([
        {
          id: data.id,
          wallet_user_id: data.wallet_user_id,
          device_id: data.device_id,
          device_name: data.device_name,
          platform: data.platform,
          status: "active",
          last_active: new Date().toISOString(),
        },
      ]);
      if (error) {
        console.error("[DB Service] Supabase error bindDevice:", error.message);
        throw error;
      }
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      `INSERT INTO device_bindings (id, wallet_user_id, device_id, device_name, platform, status, last_active)
       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET last_active = CURRENT_TIMESTAMP`,
      [data.id, data.wallet_user_id, data.device_id, data.device_name, data.platform]
    );
  }

  // ─── Linked Locker Operations ──────────────────────────────────────────────
  async linkLocker(data: {
    id: string;
    wallet_user_id: string;
    locker_provider: string;
    locker_user_id: string;
    locker_access_token: string;
  }): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { error } = await supabaseWallet.from("linked_lockers").insert([data]);
      if (error) {
        console.error("[DB Service] Supabase error linkLocker:", error.message);
        throw error;
      }
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      `INSERT INTO linked_lockers (id, wallet_user_id, locker_provider, locker_user_id, locker_access_token)
       VALUES (?, ?, ?, ?, ?)`,
      [data.id, data.wallet_user_id, data.locker_provider, data.locker_user_id, data.locker_access_token]
    );
  }

  async getLatestLinkedLocker(walletUserId: string): Promise<LinkedLockerRecord | null> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { data, error } = await supabaseWallet
        .from("linked_lockers")
        .select("*")
        .eq("wallet_user_id", walletUserId)
        .order("linked_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("[DB Service] Supabase error getLatestLinkedLocker:", error.message);
        return null;
      }
      return data && data.length > 0 ? (data[0] as LinkedLockerRecord) : null;
    }

    // SQLite Fallback
    const locker = sqliteDb
      .query("SELECT * FROM linked_lockers WHERE wallet_user_id = ? ORDER BY linked_at DESC LIMIT 1")
      .get(walletUserId) as LinkedLockerRecord | null;
    return locker || null;
  }

  // ─── Consent Verification Requests (UPI Collect Flow) ──────────────────────
  async createConsentRequest(req: ConsentRequestRecord): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { error } = await supabaseWallet.from("consent_requests").insert([req]);
      if (error) {
        console.error("[DB Service] Supabase error createConsentRequest:", error.message);
        throw error;
      }
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      `INSERT INTO consent_requests (
        id, wallet_user_id, verifier_name, document_id, document_title, requested_fields, reason, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        req.id,
        req.wallet_user_id,
        req.verifier_name,
        req.document_id || null,
        req.document_title,
        req.requested_fields,
        req.reason || null,
        req.expires_at,
      ]
    );
  }

  async getPendingConsentRequests(walletUserId: string, nowIso: string): Promise<ConsentRequestRecord[]> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { data, error } = await supabaseWallet
        .from("consent_requests")
        .select("*")
        .eq("wallet_user_id", walletUserId)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[DB Service] Supabase error getPendingConsentRequests:", error.message);
        return [];
      }
      return (data || []) as ConsentRequestRecord[];
    }

    // SQLite Fallback
    const rows = sqliteDb
      .query(
        `SELECT * FROM consent_requests 
         WHERE wallet_user_id = ? AND status = 'pending' AND expires_at > ?
         ORDER BY created_at DESC`
      )
      .all(walletUserId, nowIso) as ConsentRequestRecord[];
    return rows;
  }

  async getConsentRequestById(id: string, walletUserId?: string): Promise<ConsentRequestRecord | null> {
    if (isSupabaseConfigured && supabaseWallet) {
      let query = supabaseWallet.from("consent_requests").select("*").eq("id", id);
      if (walletUserId) query = query.eq("wallet_user_id", walletUserId);
      const { data, error } = await query.single();
      if (error) return null;
      return data as ConsentRequestRecord;
    }

    // SQLite Fallback
    let sql = "SELECT * FROM consent_requests WHERE id = ?";
    const params: any[] = [id];
    if (walletUserId) {
      sql += " AND wallet_user_id = ?";
      params.push(walletUserId);
    }
    const row = sqliteDb.query(sql).get(...params) as ConsentRequestRecord | null;
    return row || null;
  }

  async updateConsentRequest(
    id: string,
    status: string,
    disclosedData: string | null
  ): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      const { error } = await supabaseWallet
        .from("consent_requests")
        .update({ status, disclosed_data: disclosedData })
        .eq("id", id);
      if (error) {
        console.error("[DB Service] Supabase error updateConsentRequest:", error.message);
        throw error;
      }
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      "UPDATE consent_requests SET status = ?, disclosed_data = ? WHERE id = ?",
      [status, disclosedData, id]
    );
  }

  // ─── Verification Logs ─────────────────────────────────────────────────────
  async logVerification(data: { id: string; token_verified: string; status: string }): Promise<void> {
    if (isSupabaseConfigured && supabaseWallet) {
      await supabaseWallet.from("verification_logs").insert([data]);
      return;
    }

    // SQLite Fallback
    sqliteDb.run(
      "INSERT INTO verification_logs (id, token_verified, status) VALUES (?, ?, ?)",
      [data.id, data.token_verified, data.status]
    );
  }
}

export const dbService = new WalletDatabaseService();
