-- Repair/reconcile migration for teacher_profiles.
--
-- Root-cause note: saveTeacherProfile() uses
--   .upsert(row, { onConflict: "user_id" })
-- which compiles to `INSERT ... ON CONFLICT (user_id) DO UPDATE`. That
-- requires a UNIQUE (or PK) constraint on user_id to exist on the live
-- table. If the original 20260802040000_teacher_profiles.sql migration
-- was authored but never actually applied to the connected Supabase
-- project (e.g. it was committed but the project hadn't synced/migrated
-- yet), the table/constraint/policies simply wouldn't exist yet — which
-- would explain "the form works, but Save fails" exactly: reads/writes
-- against a table that isn't there yet fail, while the UI's own (now
-- fixed) silent error-swallowing on the read masked the first half of
-- that symptom.
--
-- Everything below is written to be safe to run whether the table/columns/
-- constraint/policies already exist or not.

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nip TEXT,
  school_name TEXT NOT NULL,
  principal_name TEXT,
  principal_nip TEXT,
  subject TEXT,
  education_level TEXT,
  semester TEXT,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- In case an earlier/partial version of the table exists without some
-- columns (no-op if they're already there).
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS nip TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS principal_name TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS principal_nip TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS education_level TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE public.teacher_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- The UNIQUE constraint that upsert(onConflict: "user_id") depends on.
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard with an exception
-- handler instead (42710 = duplicate_object, raised if it already exists).
DO $$
BEGIN
  ALTER TABLE public.teacher_profiles ADD CONSTRAINT teacher_profiles_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

-- Re-create policies idempotently so this migration also self-heals a case
-- where the table exists but RLS policies are missing/incomplete.
DROP POLICY IF EXISTS "Users can view own teacher profile" ON public.teacher_profiles;
CREATE POLICY "Users can view own teacher profile" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own teacher profile" ON public.teacher_profiles;
CREATE POLICY "Users can insert own teacher profile" ON public.teacher_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own teacher profile" ON public.teacher_profiles;
CREATE POLICY "Users can update own teacher profile" ON public.teacher_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own teacher profile" ON public.teacher_profiles;
CREATE POLICY "Users can delete own teacher profile" ON public.teacher_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_teacher_profiles_updated_at ON public.teacher_profiles;
CREATE TRIGGER update_teacher_profiles_updated_at BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
