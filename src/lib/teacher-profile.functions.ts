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
  switch (error.code) {
    case "42501": // insufficient_privilege (RLS reject)
    case "PGRST301":
      return "Permission denied. Anda tidak memiliki izin untuk operasi ini.";
    case "42P01": // undefined_table
      return "Database belum siap (tabel profil belum tersedia). Coba lagi sebentar atau hubungi admin.";
    case "23505": // unique_violation
      return "Database constraint failed (profil untuk akun ini sudah ada).";
    case "23502": // not_null_violation
    case "23503": // foreign_key_violation
      return "Database constraint failed. Periksa kembali data yang diisi.";
    default:
      return "Unable to save profile. Silakan coba lagi.";
  }
}

export const saveTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TeacherProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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

    // Debug: dicetak ke log server (bukan ke client) sebelum setiap upsert,
    // agar kegagalan bisa didiagnosis dari User ID + payload + error asli.
    console.log("[saveTeacherProfile] userId:", userId);
    console.log("[saveTeacherProfile] payload:", row);

    // upsert (bukan selalu INSERT): kalau baris user_id ini sudah ada, DO
    // UPDATE; kalau belum, INSERT — mencegah duplikasi profil per user.
    // Bergantung pada UNIQUE constraint di kolom user_id (lihat migrasi).
    const { data: response, error } = await supabase
      .from("teacher_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .maybeSingle();

    console.log("[saveTeacherProfile] supabase response:", response);
    if (error) {
      console.error("[saveTeacherProfile] supabase error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(friendlyDbErrorMessage(error));
    }
    return { saved: true };
  });

export const getTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    console.log("[getTeacherProfile] userId:", userId);
    const { data: row, error } = await supabase
      .from("teacher_profiles")
      .select(
        "full_name, nip, school_name, principal_name, principal_nip, subject, education_level, semester, academic_year",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[getTeacherProfile] supabase error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
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
  });
