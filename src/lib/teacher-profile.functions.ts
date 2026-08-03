import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Teacher Profile — tabel `teacher_profiles`, satu baris per user_id.
 * Diisi sekali oleh guru, lalu dipakai untuk auto-fill form & dokumen di
 * setiap sesi berikutnya (Sprint 3).
 */

const TeacherProfileSchema = z.object({
  fullName: z.string().min(1),
  schoolName: z.string().min(1),
  nip: z.string().optional().default(""),
  principalName: z.string().optional().default(""),
  principalNip: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  educationLevel: z.string().optional().default(""),
  semester: z.string().optional().default(""),
  academicYear: z.string().optional().default(""),
});

export type TeacherProfileType = z.infer<typeof TeacherProfileSchema>;

/** Terjemahkan error Postgres/PostgREST mentah menjadi pesan yang aman ditampilkan ke pengguna. */
function friendlyDbErrorMessage(error: { code?: string; message: string }): string {
  const raw = ` (${error.code ?? "no-code"}: ${error.message})`;
  switch (error.code) {
    case "42501": // insufficient_privilege (RLS reject)
      return `Permission denied.${raw}`;
    case "42P01": // undefined_table
      return `Database belum siap: tabel profil belum tersedia.${raw}`;
    case "PGRST205": // PostgREST schema cache doesn't know this table/column yet
    case "PGRST204":
    case "PGRST202":
      return `Database belum siap: skema belum ter-refresh di PostgREST.${raw}`;
    case "PGRST301": // JWT expired/invalid
      return `Sesi tidak valid, silakan masuk ulang.${raw}`;
    case "23505": // unique_violation
      return `Database constraint failed: profil untuk akun ini sudah ada.${raw}`;
    case "23502": // not_null_violation
    case "23503": // foreign_key_violation
      return `Database constraint failed.${raw}`;
    default:
      // Tidak pernah menyembunyikan error sepenuhnya di balik pesan generik —
      // kode + pesan asli selalu ikut tampil agar mudah didiagnosis.
      return `Unable to save profile.${raw}`;
  }
}

function logSupabaseError(
  label: string,
  error: { code?: string; message: string; details?: string | null; hint?: string | null },
) {
  console.error(`[${label}] Supabase error:`, error);
  console.error(`[${label}] error.message:`, error.message);
  console.error(`[${label}] error.code:`, error.code);
  console.error(`[${label}] error.details:`, error.details);
  console.error(`[${label}] error.hint:`, error.hint);
}

export const saveTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TeacherProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const row = {
      user_id: userId,
      full_name: data.fullName,
      nip: data.nip,
      school_name: data.schoolName,
      principal_name: data.principalName,
      principal_nip: data.principalNip,
      subject: data.subject,
      education_level: data.educationLevel,
      semester: data.semester,
      academic_year: data.academicYear,
      updated_at: new Date().toISOString(),
    };

    // Step 2: debug sebelum memanggil Supabase — user, payload, tabel, operasi.
    console.log("[saveTeacherProfile] current authenticated user (claims):", claims);
    console.log("[saveTeacherProfile] current user.id:", userId);
    console.log("[saveTeacherProfile] payload being sent:", row);
    console.log("[saveTeacherProfile] table:", "teacher_profiles");
    console.log("[saveTeacherProfile] operation: upsert (insert-or-update on user_id)");

    // Seluruh proses save dibungkus try/catch — bukan cuma cek `if (error)` —
    // supaya error non-Postgrest (network, serialisasi, dsb.) juga tertangkap
    // dan tercetak, bukan lolos tak tercatat.
    try {
      // upsert: kalau baris user_id ini sudah ada, DO UPDATE; kalau belum,
      // INSERT — mencegah duplikasi profil per user. Bergantung pada UNIQUE
      // constraint di kolom user_id (lihat migrasi).
      const { data: response, error } = await supabase
        .from("teacher_profiles")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .maybeSingle();

      console.log("[saveTeacherProfile] supabase response:", response);

      if (error) {
        logSupabaseError("saveTeacherProfile", error);
        throw new Error(friendlyDbErrorMessage(error));
      }
      return { saved: true };
    } catch (error) {
      console.error("[saveTeacherProfile] caught error:", error);
      if (error instanceof Error && error.message.startsWith("Unable to save profile")) throw error;
      if (
        error instanceof Error &&
        /permission denied|database|sesi tidak valid/i.test(error.message)
      )
        throw error;
      throw new Error(
        `Unable to save profile. (unexpected: ${error instanceof Error ? error.message : String(error)})`,
      );
    }
  });

export const getTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    console.log("[getTeacherProfile] current authenticated user (claims):", claims);
    console.log("[getTeacherProfile] current user.id:", userId);
    console.log("[getTeacherProfile] table:", "teacher_profiles");
    console.log("[getTeacherProfile] operation: select");
    try {
      const { data: row, error } = await supabase
        .from("teacher_profiles")
        .select(
          "full_name, nip, school_name, principal_name, principal_nip, subject, education_level, semester, academic_year",
        )
        .eq("user_id", userId)
        .maybeSingle();

      console.log("[getTeacherProfile] supabase response:", row);
      if (error) {
        logSupabaseError("getTeacherProfile", error);
        throw new Error(friendlyDbErrorMessage(error));
      }
      if (!row) return { found: false as const };
      return {
        found: true as const,
        profile: {
          fullName: row.full_name,
          nip: row.nip ?? "",
          schoolName: row.school_name,
          principalName: row.principal_name ?? "",
          principalNip: row.principal_nip ?? "",
          subject: row.subject ?? "",
          educationLevel: row.education_level ?? "",
          semester: row.semester ?? "",
          academicYear: row.academic_year ?? "",
        } satisfies TeacherProfileType,
      };
    } catch (error) {
      console.error("[getTeacherProfile] caught error:", error);
      if (error instanceof Error) throw error;
      throw new Error(`Unable to load profile. (unexpected: ${String(error)})`);
    }
  });
