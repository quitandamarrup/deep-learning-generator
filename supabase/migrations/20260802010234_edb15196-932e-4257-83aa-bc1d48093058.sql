CREATE TABLE public.master_kurikulum (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_email TEXT,
  subject TEXT NOT NULL,
  semester TEXT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  jenjang TEXT,
  kelas TEXT,
  fase TEXT,
  cp TEXT NOT NULL,
  cp_hash TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject, semester, tahun_ajaran)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_kurikulum TO authenticated;
GRANT ALL ON public.master_kurikulum TO service_role;

ALTER TABLE public.master_kurikulum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own master kurikulum" ON public.master_kurikulum
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own master kurikulum" ON public.master_kurikulum
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own master kurikulum" ON public.master_kurikulum
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own master kurikulum" ON public.master_kurikulum
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_master_kurikulum_updated_at BEFORE UPDATE ON public.master_kurikulum
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();