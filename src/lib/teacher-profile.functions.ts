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

export const saveTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TeacherProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("teacher_profiles").upsert(
      {
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
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const getTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("teacher_profiles")
      .select(
        "full_name, nip, school_name, principal_name, principal_nip, subject, education_level, semester, academic_year",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
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
