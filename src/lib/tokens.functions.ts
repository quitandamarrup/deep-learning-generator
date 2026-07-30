import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function norm(s: string) {
  return s.trim().toLowerCase();
}

// Check if the current user already has access for a given subject + semester.
export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subject: z.string().min(1), semester: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("download_tokens")
      .select("id, subject, semester, status")
      .eq("user_id", userId)
      .eq("status", "redeemed");
    if (error) throw new Error(error.message);
    const has = (rows ?? []).some(
      (r) =>
        norm(r.subject ?? "") === norm(data.subject) &&
        norm(r.semester ?? "") === norm(data.semester),
    );
    return { hasAccess: has };
  });

// Redeem token for user+subject+semester. Binds if unbound; verifies if already bound.
export const redeemToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1).max(64),
        subject: z.string().min(1),
        semester: z.string().min(1),
        level: z.string().optional().default(""),
        classPhase: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const userEmail = (claims as { email?: string } | null)?.email ?? null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenTrim = data.token.trim();

    const { data: row, error } = await supabaseAdmin
      .from("download_tokens")
      .select("*")
      .eq("token", tokenTrim)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "Token tidak ditemukan." };
    if (row.status === "disabled") return { ok: false as const, reason: "Token telah dinonaktifkan." };

    // Not yet bound → bind to this user + subject + semester
    if (row.status === "active" && !row.user_id) {
      const { error: upErr } = await supabaseAdmin
        .from("download_tokens")
        .update({
          status: "redeemed",
          user_id: userId,
          user_email: userEmail,
          subject: data.subject,
          semester: data.semester,
          level: data.level || null,
          class_phase: data.classPhase || null,
          redeemed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true as const, boundSubject: data.subject, boundSemester: data.semester };
    }

    // Already redeemed → must match user + subject + semester
    if (row.user_id !== userId) {
      return { ok: false as const, reason: "Token ini sudah terikat pada pengguna lain." };
    }
    if (norm(row.subject ?? "") !== norm(data.subject)) {
      return {
        ok: false as const,
        reason: `Token ini hanya berlaku untuk Mata Pelajaran ${row.subject}. Silakan gunakan token baru untuk mata pelajaran lainnya.`,
        boundSubject: row.subject ?? "",
      };
    }
    if (norm(row.semester ?? "") !== norm(data.semester)) {
      return {
        ok: false as const,
        reason: `Token ini hanya berlaku untuk Semester ${row.semester}. Silakan gunakan token baru untuk semester lainnya.`,
        boundSubject: row.subject ?? "",
      };
    }
    return {
      ok: true as const,
      boundSubject: row.subject ?? data.subject,
      boundSemester: row.semester ?? data.semester,
    };
  });


// Admin: list tokens
export const adminListTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("download_tokens")
      .select("id, token, status, user_id, subject, redeemed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { tokens: data ?? [] };
  });

// Admin: generate tokens
function randomToken(len = 12) {
  // crypto-secure random, base32-ish alphabet (no ambiguous chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const adminGenerateTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ count: z.number().int().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Array.from({ length: data.count }, () => ({ token: randomToken(12) }));
    const { data: inserted, error } = await supabaseAdmin
      .from("download_tokens")
      .insert(rows)
      .select("token");
    if (error) throw new Error(error.message);
    return { tokens: (inserted ?? []).map((r) => r.token) };
  });

export const adminDisableToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("download_tokens")
      .update({ status: "disabled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });
