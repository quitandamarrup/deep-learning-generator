import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateRPP, type RppInputType } from "@/lib/rpp.functions";
import { analyzeCP, type CpTopic } from "@/lib/cp-analysis.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, Copy, Printer, Download, RefreshCw, Pencil, FileText, LogOut, Sparkles, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Generator RPP Pembelajaran Mendalam" },
      {
        name: "description",
        content:
          "Buat perencanaan pembelajaran yang sistematis, kontekstual, dan sesuai kebutuhan peserta didik.",
      },
      { property: "og:title", content: "Generator RPP Pembelajaran Mendalam" },
      {
        property: "og:description",
        content: "Generator RPP otomatis untuk semua mata pelajaran dan jenjang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const defaultForm: RppInputType = {
  penyusun: "",
  satuan: "",
  tahunAjaran: "",
  semester: "Ganjil",
  jenjang: "SD/MI",
  kelas: "",
  fase: "",
  mapel: "",
  materi: "",
  alokasi: "",
  pertemuan: "1",
  cp: "",
  info: "",
};

function Index() {
  const runGenerate = useServerFn(generateRPP);
  const runAnalyze = useServerFn(analyzeCP);
  const [form, setForm] = useState<RppInputType>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [topics, setTopics] = useState<CpTopic[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) toast.error("Gagal masuk dengan Google.");
    } catch {
      toast.error("Gagal masuk dengan Google.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setResult("");
    toast.success("Anda telah keluar.");
  };

  const update = (k: keyof RppInputType, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const required: (keyof RppInputType)[] = [
      "penyusun",
      "satuan",
      "tahunAjaran",
      "semester",
      "jenjang",
      "kelas",
      "fase",
      "mapel",
      "materi",
      "alokasi",
      "pertemuan",
      "cp",
    ];
    for (const k of required) {
      if (!form[k] || !String(form[k]).trim()) {
        toast.error("Mohon lengkapi semua field wajib.");
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!user) {
      toast.error("Silakan masuk dengan akun Google untuk membuat dokumen.");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await runGenerate({ data: form });
      setResult(res.markdown);
      setEditing(false);
      setTimeout(
        () => document.getElementById("rpp-result")?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat RPP. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    const need: (keyof RppInputType)[] = ["jenjang", "kelas", "fase", "mapel", "semester", "cp", "alokasi"];
    for (const k of need) {
      if (!form[k] || !String(form[k]).trim()) {
        toast.error("Lengkapi Jenjang, Kelas, Fase, Mapel, Semester, CP, dan Alokasi JP per pertemuan.");
        return;
      }
    }
    setAnalyzing(true);
    try {
      const res = await runAnalyze({
        data: {
          jenjang: form.jenjang,
          kelas: form.kelas,
          fase: form.fase,
          mapel: form.mapel,
          semester: form.semester,
          cp: form.cp,
          alokasiPerPertemuan: form.alokasi,
        },
      });
      setTopics(res.topics);
      setTimeout(
        () => document.getElementById("cp-analysis")?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (e) {
      console.error(e);
      toast.error("Gagal menganalisis CP. Silakan coba lagi.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateTopic = (idx: number, patch: Partial<CpTopic>) => {
    setTopics((ts) => (ts ? ts.map((t, i) => (i === idx ? { ...t, ...patch } : t)) : ts));
  };
  const removeTopic = (idx: number) => {
    setTopics((ts) => (ts ? ts.filter((_, i) => i !== idx).map((t, i) => ({ ...t, no: i + 1 })) : ts));
  };
  const addTopic = () => {
    setTopics((ts) => {
      const next = ts ? [...ts] : [];
      next.push({
        no: next.length + 1,
        materi: "",
        kompetensi: "",
        pertemuan: 1,
        alokasi: `1 x (${form.alokasi || "..."})`,
      });
      return next;
    });
  };

  const pickTopic = (t: CpTopic) => {
    setForm((f) => ({
      ...f,
      materi: t.materi,
      pertemuan: String(t.pertemuan),
      alokasi: t.alokasi || f.alokasi,
    }));
    toast.success(`Topik "${t.materi || "(tanpa judul)"}" digunakan. Klik Generate RPP.`);
    setTimeout(
      () => document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toast.success("RPP disalin ke clipboard.");
  };

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RPP-${form.mapel || "output"}-${form.kelas || ""}.md`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <Toaster position="top-center" />
      <header className="bg-[#0f2b5b] text-white shadow-md print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                Generator RPP Pembelajaran Mendalam
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Buat perencanaan pembelajaran yang sistematis, kontekstual, dan sesuai kebutuhan
                peserta didik.
              </p>
            </div>
            <div className="shrink-0">
              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  {user.user_metadata?.avatar_url && (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profil"
                      className="h-9 w-9 rounded-full border border-white/20"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="hidden text-right text-xs sm:block">
                    <div className="font-medium">
                      {user.user_metadata?.full_name || user.user_metadata?.name || "Pengguna"}
                    </div>
                    <div className="text-white/70">{user.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSignOut}
                    className="bg-white/10 text-white hover:bg-white/20 border-0"
                  >
                    <LogOut className="mr-1.5 h-4 w-4" /> Keluar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="bg-white text-[#0f2b5b] hover:bg-white/90"
                >
                  {authLoading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-1.5 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"/>
                    </svg>
                  )}
                  Masuk dengan Google
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <section id="form-section" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7 print:hidden">
          <h2 className="text-lg font-semibold text-slate-800">Data Perencanaan</h2>
          <p className="text-sm text-slate-500">
            Lengkapi form berikut untuk menghasilkan RPP secara otomatis.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Penyusun">
              <Input value={form.penyusun} onChange={(e) => update("penyusun", e.target.value)} />
            </Field>
            <Field label="Satuan Pendidikan">
              <Input value={form.satuan} onChange={(e) => update("satuan", e.target.value)} />
            </Field>
            <Field label="Tahun Ajaran">
              <Input
                placeholder="cth. 2025/2026"
                value={form.tahunAjaran}
                onChange={(e) => update("tahunAjaran", e.target.value)}
              />
            </Field>
            <Field label="Semester">
              <Select value={form.semester} onValueChange={(v) => update("semester", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ganjil">Ganjil</SelectItem>
                  <SelectItem value="Genap">Genap</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Jenjang">
              <Select value={form.jenjang} onValueChange={(v) => update("jenjang", v)}>
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
            </Field>
            <Field label="Kelas">
              <Input
                placeholder="cth. IV, VII, X"
                value={form.kelas}
                onChange={(e) => update("kelas", e.target.value)}
              />
            </Field>
            <Field label="Fase">
              <Input
                placeholder="cth. A, B, C, D, E, F"
                value={form.fase}
                onChange={(e) => update("fase", e.target.value)}
              />
            </Field>
            <Field label="Mata Pelajaran">
              <Input value={form.mapel} onChange={(e) => update("mapel", e.target.value)} />
            </Field>
            <Field label="Materi/Topik" className="sm:col-span-2">
              <Input value={form.materi} onChange={(e) => update("materi", e.target.value)} />
            </Field>
            <Field label="Alokasi JP per Pertemuan">
              <Input
                placeholder="cth. 2 x 40 menit"
                value={form.alokasi}
                onChange={(e) => update("alokasi", e.target.value)}
              />
            </Field>
            <Field label="Jumlah Pertemuan">
              <Input
                type="number"
                min={1}
                value={form.pertemuan}
                onChange={(e) => update("pertemuan", e.target.value)}
              />
            </Field>
            <Field label="Capaian Pembelajaran" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={form.cp}
                onChange={(e) => update("cp", e.target.value)}
                placeholder="Salin/tempel CP resmi dari dokumen kurikulum."
              />
            </Field>
            <Field label="Informasi Tambahan (opsional)" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={form.info}
                onChange={(e) => update("info", e.target.value)}
                placeholder="Karakteristik peserta didik, sumber belajar khusus, dll."
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              variant="outline"
              size="lg"
              className="border-[#0f2b5b] text-[#0f2b5b] hover:bg-[#0f2b5b]/5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menganalisis CP...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analisis CP
                </>
              )}
            </Button>
            <Button
              onClick={submit}
              disabled={loading}
              className="bg-[#0f2b5b] hover:bg-[#0a1f45]"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyusun RPP...
                </>
              ) : (
                "Generate RPP"
              )}
            </Button>
            {loading && (
              <span className="text-sm text-slate-500">
                Ini dapat memakan waktu 20–60 detik. Mohon tunggu.
              </span>
            )}
          </div>
        </section>

        {topics && (
          <section
            id="cp-analysis"
            className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7 print:hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Hasil Analisis CP</h2>
                <p className="text-sm text-slate-500">
                  Rekomendasi pembagian materi. Semua kolom dapat diedit. Pilih "Buat RPP" untuk menggunakan topik.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addTopic}>
                <Plus className="mr-1.5 h-4 w-4" /> Tambah Baris
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-700">
                    <th className="border border-slate-200 px-2 py-2 w-10">No</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[180px]">Materi/Topik</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[220px]">Kompetensi/Tujuan Utama</th>
                    <th className="border border-slate-200 px-2 py-2 w-28">Pertemuan</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[140px]">Alokasi JP</th>
                    <th className="border border-slate-200 px-2 py-2 w-40">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t, i) => (
                    <tr key={i} className="align-top">
                      <td className="border border-slate-200 px-2 py-2 text-center text-slate-600">
                        {t.no}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <Textarea
                          rows={2}
                          value={t.materi}
                          onChange={(e) => updateTopic(i, { materi: e.target.value })}
                          className="min-h-[40px]"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <Textarea
                          rows={3}
                          value={t.kompetensi}
                          onChange={(e) => updateTopic(i, { kompetensi: e.target.value })}
                          className="min-h-[40px]"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <Input
                          type="number"
                          min={1}
                          value={t.pertemuan}
                          onChange={(e) =>
                            updateTopic(i, {
                              pertemuan: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <Input
                          value={t.alokasi}
                          onChange={(e) => updateTopic(i, { alokasi: e.target.value })}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            className="bg-[#0f2b5b] hover:bg-[#0a1f45]"
                            onClick={() => pickTopic(t)}
                          >
                            Buat RPP
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeTopic(i)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}


        {result && (
          <section id="rpp-result" className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <h2 className="text-lg font-semibold text-slate-800">Preview RPP</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={submit} disabled={loading}>
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Generate Ulang
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil className="mr-1.5 h-4 w-4" /> {editing ? "Selesai Edit" : "Edit"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1.5 h-4 w-4" /> Salin
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-1.5 h-4 w-4" /> Cetak
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-4 w-4" /> Download
                </Button>
              </div>
            </div>

            {editing ? (
              <Textarea
                className="min-h-[70vh] font-mono text-sm"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              />
            ) : (
              <article className="rpp-doc rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:shadow-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </article>
            )}
          </section>
        )}

        <footer className="mt-10 pb-6 text-center text-xs text-slate-400 print:hidden">
          Generator RPP Pembelajaran Mendalam
        </footer>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
