import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getTeacherProfile,
  saveTeacherProfile,
  type TeacherProfileType,
} from "@/lib/teacher-profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, User, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profil Guru — Administrasi Pembelajaran" }] }),
  component: ProfilePage,
});

type ProfileForm = TeacherProfileType;

const emptyProfile: ProfileForm = {
  fullName: "",
  nip: "",
  schoolName: "",
  principalName: "",
  principalNip: "",
  subject: "",
  educationLevel: "SD/MI",
  semester: "Ganjil",
  academicYear: "",
};

const REQUIRED_FIELDS: { key: keyof ProfileForm; label: string }[] = [
  { key: "fullName", label: "Nama Lengkap" },
  { key: "nip", label: "NIP" },
  { key: "schoolName", label: "Nama Sekolah" },
  { key: "principalName", label: "Nama Kepala Sekolah" },
  { key: "principalNip", label: "NIP Kepala Sekolah" },
  { key: "subject", label: "Mata Pelajaran" },
  { key: "educationLevel", label: "Jenjang Pendidikan" },
  { key: "semester", label: "Semester" },
  { key: "academicYear", label: "Tahun Ajaran" },
];

function ProfilePage() {
  const runGetProfile = useServerFn(getTeacherProfile);
  const runSaveProfile = useServerFn(saveTeacherProfile);
  const navigate = useNavigate();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyProfile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    runGetProfile()
      .then((r) => {
        if (cancelled) return;
        if (r.found) {
          setForm(r.profile);
          setIsFirstTime(false);
        } else {
          setIsFirstTime(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (key: keyof ProfileForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const { key, label } of REQUIRED_FIELDS) {
      if (!form[key]?.trim()) {
        toast.error(`Lengkapi ${label}.`);
        return;
      }
    }
    setSaving(true);
    try {
      await runSaveProfile({ data: form });
      toast.success("Profil Guru tersimpan.");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan Profil Guru.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-center" />
      <header className="bg-[#0f2b5b] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
          {!isFirstTime && (
            <Link to="/">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/20 border-0"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Beranda
              </Button>
            </Link>
          )}
          <h1 className="text-lg font-bold sm:text-xl">Profil Guru</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10">
        {!user ? (
          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-500">Silakan masuk dengan Google terlebih dahulu.</p>
            <Link to="/">
              <Button size="sm" className="mt-4 bg-[#0f2b5b] hover:bg-[#0a1f45]">
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-[#0f2b5b]" />
              <h2 className="text-base font-semibold text-slate-800">
                {isFirstTime ? "Lengkapi Profil Guru" : "Edit Profil Guru"}
              </h2>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              {isFirstTime
                ? "Isi sekali saja — data ini akan otomatis mengisi setiap dokumen yang Anda buat berikutnya."
                : "Perubahan akan otomatis dipakai pada dokumen yang Anda buat setelah ini."}
            </p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => set("fullName")(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="nip">NIP</Label>
                <Input id="nip" value={form.nip} onChange={(e) => set("nip")(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="schoolName">Nama Sekolah</Label>
                <Input
                  id="schoolName"
                  value={form.schoolName}
                  onChange={(e) => set("schoolName")(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="principalName">Nama Kepala Sekolah</Label>
                <Input
                  id="principalName"
                  value={form.principalName}
                  onChange={(e) => set("principalName")(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="principalNip">NIP Kepala Sekolah</Label>
                <Input
                  id="principalNip"
                  value={form.principalNip}
                  onChange={(e) => set("principalNip")(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="subject">Mata Pelajaran</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => set("subject")(e.target.value)}
                />
              </div>
              <div>
                <Label>Jenjang Pendidikan</Label>
                <Select value={form.educationLevel} onValueChange={set("educationLevel")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SD/MI">SD/MI</SelectItem>
                    <SelectItem value="SMP/MTs">SMP/MTs</SelectItem>
                    <SelectItem value="SMA/MA">SMA/MA</SelectItem>
                    <SelectItem value="SMK/MAK">SMK/MAK</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Semester</Label>
                <Select value={form.semester} onValueChange={set("semester")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ganjil">Ganjil</SelectItem>
                    <SelectItem value="Genap">Genap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="academicYear">Tahun Ajaran</Label>
                <Input
                  id="academicYear"
                  placeholder="2025/2026"
                  value={form.academicYear}
                  onChange={(e) => set("academicYear")(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-[#0f2b5b] hover:bg-[#0a1f45]"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Simpan Profil
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
