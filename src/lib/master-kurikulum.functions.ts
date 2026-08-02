import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MasterKurikulum } from "./master-kurikulum";

/**
 * Penyimpanan MASTER_KURIKULUM (tabel `master_kurikulum`).
 * Satu baris per User + Mapel + Semester + Tahun Ajaran.
 * Jika CP berubah, baris tersebut digantikan hasil analisis terbaru (cp_hash baru).
 */

const KeySchema = z.object({
  subject: z.string().min(1),
  semester: z.string().min(1),
  tahunAjaran: z.string().min(1),
});

const SaveSchema = KeySchema.extend({
  jenjang: z.string().optional().default(""),
  kelas: z.string().optional().default(""),
  fase: z.string().optional().default(""),
  cp: z.string().min(1),
  cpHash: z.string().min(1),
  data: z.any(),
});

export const saveMasterKurikulum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { error } = await supabase.from("master_kurikulum").upsert(
      {
        user_id: userId,
        user_email: (claims as { email?: string })?.email ?? null,
        subject: data.subject,
        semester: data.semester,
        tahun_ajaran: data.tahunAjaran,
        jenjang: data.jenjang,
        kelas: data.kelas,
        fase: data.fase,
        cp: data.cp,
        cp_hash: data.cpHash,
        data: data.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,subject,semester,tahun_ajaran" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const loadMasterKurikulum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KeySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("master_kurikulum")
      .select("cp, cp_hash, data, updated_at")
      .eq("user_id", userId)
      .eq("subject", data.subject)
      .eq("semester", data.semester)
      .eq("tahun_ajaran", data.tahunAjaran)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    return {
      found: true as const,
      cp: row.cp,
      cpHash: row.cp_hash,
      updatedAt: row.updated_at,
      masterKurikulum: row.data as unknown as MasterKurikulum,
    };
  });
