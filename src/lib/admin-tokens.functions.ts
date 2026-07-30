import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminListTokens = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-auth.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("download_tokens")
    .select(
      "id, token, status, user_id, user_email, subject, level, class_phase, redeemed_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return { tokens: data ?? [] };
});

export const adminCreateToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ count: z.number().int().min(1).max(200).default(1) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-auth.server");
    const { makeToken } = await import("./admin-tokens.server");
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Array.from({ length: data.count }, () => ({ token: makeToken() }));
    const { data: inserted, error } = await supabaseAdmin
      .from("download_tokens")
      .insert(rows)
      .select("token");
    if (error) throw new Error(error.message);
    return { tokens: (inserted ?? []).map((r) => r.token) };
  });

export const adminDisableTokenV2 = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-auth.server");
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("download_tokens")
      .update({ status: "disabled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-auth.server");
    await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rErr } = await supabaseAdmin
      .from("download_tokens")
      .select("id, user_id, redeemed_at")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) return { ok: false as const, reason: "Token tidak ditemukan." };
    if (row.user_id || row.redeemed_at) {
      return { ok: false as const, reason: "Token sudah digunakan; tidak dapat dihapus." };
    }
    const { error } = await supabaseAdmin.from("download_tokens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
