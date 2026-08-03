CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nip text DEFAULT '',
  school_name text NOT NULL,
  principal_name text DEFAULT '',
  principal_nip text DEFAULT '',
  subject text DEFAULT '',
  education_level text DEFAULT '',
  semester text DEFAULT '',
  academic_year text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_profiles_user_id_key UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own teacher profile" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own teacher profile" ON public.teacher_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teacher profile" ON public.teacher_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own teacher profile" ON public.teacher_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';