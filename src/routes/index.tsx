import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyzeCP, type CpTopic } from "@/lib/cp-analysis.functions";
import {
  DOC_LABELS,
  DOC_TYPES,
  generateDoc,
  type DocContextType,
  type DocType,
} from "@/lib/admin-docs.functions";
import { checkAccess, redeemToken, isAdmin as isAdminFn } from "@/lib/tokens.functions";
import { downloadDocx, downloadPdf, downloadZipOfDocs } from "@/lib/exporters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Loader2,
  Download,
  FileText,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
  Key,
  MessageCircle,
  Shield,
  Package,
  FileDown,
  FileType,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Generator Administrasi Pembelajaran" },
      {
        name: "description",
        content:
          "Generator lengkap RPP, TP, ATP, PROTA, PROSEM, KKTP, Modul Ajar, LKPD, Asesmen, dan Rubrik berbasis Analisis CP.",
      },
      { property: "og:title", content: "Generator Administrasi Pembelajaran" },
      {
        property: "og:description",
        content:
          "Buat seluruh administrasi pembelajaran otomatis dari satu Capaian Pembelajaran.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type FormState = {
  penyusun: string;
  satuan: string;
  tahunAjaran: string;
  semester: string;
  jenjang: string;
  kelas: string;
  fase: string;
  mapel: string;
  alokasi: string;
  cp: string;
  info: string;
};

const defaultForm: FormState = {
  penyusun: "",
  satuan: "",
  tahunAjaran: "",
  semester: "Ganjil",
  jenjang: "SD/MI",
  kelas: "",
  fase: "",
  mapel: "",
  alokasi: "",
  cp: "",
  info: "",
};

// Docs where a specific topic is required
const TOPIC_SCOPED: DocType[] = ["RPP", "MODUL", "MATERI", "LKPD", "ASESMEN", "KISI", "SOAL", "RUBRIK"];

function Index() {
  const runAnalyze = useServerFn(analyzeCP);
  const runGenerate = useServerFn(generateDoc);
  const runCheckAccess = useServerFn(checkAccess);
  const runRedeem = useServerFn(redeemToken);
  const runIsAdmin = useServerFn(isAdminFn);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [topics, setTopics] = useState<CpTopic[] | null>(null);
  const [selectedTopicNo, setSelectedTopicNo] = useState<number | null>(null);

  const [selectedDocs, setSelectedDocs] = useState<Set<DocType>>(new Set(["RPP"]));
  const [generatingDoc, setGeneratingDoc] = useState<DocType | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [docs, setDocs] = useState<Partial<Record<DocType, string>>>({});
  const [activeTab, setActiveTab] = useState<DocType | null>(null);

  const [hasAccess, setHasAccess] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [payMethod, setPayMethod] = useState<"Transfer Superbank" | "GoPay" | "DANA">(
    "Transfer Superbank",
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Check admin + access when user or mapel changes
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setHasAccess(false);
      return;
    }
    runIsAdmin().then((r) => setIsAdmin(r.isAdmin)).catch(() => {});
  }, [user, runIsAdmin]);

  useEffect(() => {
    if (!user || !form.mapel.trim() || !form.semester.trim()) {
      setHasAccess(false);
      return;
    }
    runCheckAccess({ data: { subject: form.mapel, semester: form.semester } })
      .then((r) => setHasAccess(r.hasAccess))
      .catch(() => setHasAccess(false));
  }, [user, form.mapel, form.semester, runCheckAccess]);

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
    setDocs({});
    setTopics(null);
    setSelectedTopicNo(null);
    toast.success("Anda telah keluar.");
  };

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const requireContext = (needTopic = false): DocContextType | null => {
    const need: (keyof FormState)[] = [
      "penyusun",
      "satuan",
      "tahunAjaran",
      "semester",
      "jenjang",
      "kelas",
      "fase",
      "mapel",
      "alokasi",
      "cp",
    ];
    for (const k of need) {
      if (!form[k]?.trim()) {
        toast.error("Lengkapi semua data wajib pada form.");
        return null;
      }
    }
    if (!topics || topics.length === 0) {
      toast.error("Jalankan Analisis CP terlebih dahulu untuk menentukan materi & pertemuan.");
      return null;
    }
    if (needTopic && !selectedTopicNo) {
      toast.error("Pilih salah satu materi hasil Analisis CP.");
      return null;
    }
    return {
      penyusun: form.penyusun,
      satuan: form.satuan,
      tahunAjaran: form.tahunAjaran,
      semester: form.semester,
      jenjang: form.jenjang,
      kelas: form.kelas,
      fase: form.fase,
      mapel: form.mapel,
      cp: form.cp,
      alokasiPerPertemuan: form.alokasi,
      info: form.info,
      topics,
      selectedTopicNo: selectedTopicNo ?? undefined,
    };
  };

  const handleAnalyze = async () => {
    const need: (keyof FormState)[] = ["jenjang", "kelas", "fase", "mapel", "semester", "cp", "alokasi"];
    for (const k of need) {
      if (!form[k]?.trim()) {
        toast.error("Lengkapi Jenjang, Kelas, Fase, Mapel, Semester, CP, dan Alokasi JP.");
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
      setSelectedTopicNo(res.topics[0]?.no ?? null);
      setDocs({}); // invalidate old docs
      setActiveTab(null);
      setTimeout(
        () => document.getElementById("cp-analysis")?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch (e) {
      console.error(e);
      toast.error("Gagal menganalisis CP. Coba lagi.");
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

  const toggleDoc = (d: DocType) => {
    setSelectedDocs((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  };

  const generateOne = async (docType: DocType, ctx: DocContextType) => {
    const res = await runGenerate({ data: { docType, context: ctx } });
    setDocs((prev) => ({ ...prev, [docType]: res.markdown }));
    return res.markdown;
  };

  const handleGenerateSelected = async () => {
    if (!user) {
      toast.error("Silakan masuk dengan Google terlebih dahulu.");
      return;
    }
    if (selectedDocs.size === 0) {
      toast.error("Pilih minimal satu jenis dokumen.");
      return;
    }
    const needTopic = Array.from(selectedDocs).some((d) => TOPIC_SCOPED.includes(d));
    const ctx = requireContext(needTopic);
    if (!ctx) return;
    for (const d of Array.from(selectedDocs)) {
      setGeneratingDoc(d);
      try {
        await generateOne(d, ctx);
        setActiveTab(d);
      } catch (e) {
        console.error(e);
        toast.error(`Gagal membuat ${DOC_LABELS[d]}.`);
      }
    }
    setGeneratingDoc(null);
    toast.success("Dokumen selesai dibuat.");
  };

  const handleGenerateAll = async () => {
    if (!user) {
      toast.error("Silakan masuk dengan Google terlebih dahulu.");
      return;
    }
    const ctx = requireContext(true);
    if (!ctx) return;
    setGeneratingAll(true);
    try {
      for (const d of DOC_TYPES) {
        setGeneratingDoc(d);
        try {
          await generateOne(d, ctx);
          setActiveTab(d);
        } catch (e) {
          console.error(e);
          toast.error(`Gagal membuat ${DOC_LABELS[d]}.`);
        }
      }
      toast.success("Seluruh administrasi berhasil dibuat.");
    } finally {
      setGeneratingDoc(null);
      setGeneratingAll(false);
    }
  };

  const ensureAccess = async (): Promise<boolean> => {
    if (!user) {
      toast.error("Silakan masuk dengan Google terlebih dahulu.");
      return false;
    }
    if (!form.mapel.trim() || !form.semester.trim()) {
      toast.error("Isi Mata Pelajaran dan Semester terlebih dahulu.");
      return false;
    }
    if (hasAccess) return true;
    setTokenOpen(true);
    return false;
  };

  const handleVerifyToken = async () => {
    if (!tokenValue.trim()) {
      toast.error("Masukkan token.");
      return;
    }
    setVerifying(true);
    try {
      const res = await runRedeem({
        data: {
          token: tokenValue.trim(),
          subject: form.mapel,
          semester: form.semester,
          level: form.jenjang,
          classPhase: `${form.kelas}/${form.fase}`,
        },
      });
      if (res.ok) {
        toast.success(
          `Paket berhasil diaktifkan. ${form.mapel} – Semester ${form.semester}. Anda sekarang dapat mengakses seluruh Administrasi Pembelajaran dalam paket ini.`,
        );
        setHasAccess(true);
        setTokenOpen(false);
        setTokenValue("");
      } else {
        toast.error(res.reason ?? "Token tidak valid.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal memverifikasi token.");
    } finally {
      setVerifying(false);
    }
  };

  const waLink = useMemo(() => {
    const t = selectedTopicNo ? topics?.find((x) => x.no === selectedTopicNo) : undefined;
    const nama =
      form.penyusun ||
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      "-";
    const email = user?.email || "-";
    const msg = `Halo Admin, saya sudah melakukan pembayaran Paket Administrasi Pembelajaran sebesar Rp49.000.\n\nNama: ${nama}\nEmail: ${email}\nMata Pelajaran: ${form.mapel || "-"}\nSemester: ${form.semester || "-"}\nJenjang: ${form.jenjang || "-"}\nKelas/Fase: ${form.kelas || "-"}/${form.fase || "-"}\n\nMetode Pembayaran: ${payMethod || "-"}${t ? `\nTopik: ${t.materi}` : ""}\n\nMohon token aktivasi. Saya akan mengirimkan bukti pembayaran.`;
    return `https://wa.me/6289502690216?text=${encodeURIComponent(msg)}`;
  }, [form, selectedTopicNo, topics, user, payMethod]);

  const filenameFor = (d: DocType) =>
    `${d}-${(form.mapel || "output").replace(/\s+/g, "_")}-${(form.kelas || "").replace(/\s+/g, "_")}`;

  const handleDownload = async (d: DocType, fmt: "docx" | "pdf") => {
    const md = docs[d];
    if (!md) return;
    const ok = await ensureAccess();
    if (!ok) return;
    const title = `${DOC_LABELS[d]} — ${form.mapel} ${form.kelas}`;
    if (fmt === "docx") await downloadDocx(filenameFor(d), md, title);
    else downloadPdf(filenameFor(d), md, title);
  };

  const handleDownloadAll = async (fmt: "docx" | "pdf") => {
    const entries = (Object.entries(docs) as [DocType, string][]).filter(([, v]) => !!v);
    if (entries.length === 0) {
      toast.error("Belum ada dokumen yang dibuat.");
      return;
    }
    const ok = await ensureAccess();
    if (!ok) return;
    await downloadZipOfDocs(
      `Administrasi-${(form.mapel || "output").replace(/\s+/g, "_")}-${(form.kelas || "").replace(/\s+/g, "_")}`,
      entries.map(([d, md]) => ({
        key: d,
        filename: filenameFor(d),
        markdown: md,
        title: `${DOC_LABELS[d]} — ${form.mapel} ${form.kelas}`,
      })),
      fmt,
    );
  };

  const generatedList = (Object.keys(docs) as DocType[]).filter((d) => !!docs[d]);
  const currentTab = activeTab && docs[activeTab] ? activeTab : generatedList[0] ?? null;

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
                Generator Administrasi Pembelajaran
              </h1>
              <p className="mt-1 text-sm text-white/80">
                RPP, TP, ATP, PROTA, PROSEM, KKTP, Modul, LKPD, Asesmen, Rubrik — dari satu CP.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin/tokens">
                  <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
                    <Shield className="mr-1.5 h-4 w-4" /> Admin
                  </Button>
                </Link>
              )}
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
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z" />
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
            Materi/Topik & jumlah pertemuan diperoleh otomatis dari Analisis CP.
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
            <Field label="Alokasi JP per Pertemuan">
              <Input
                placeholder="cth. 2 x 40 menit"
                value={form.alokasi}
                onChange={(e) => update("alokasi", e.target.value)}
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
              size="lg"
              className="bg-[#0f2b5b] hover:bg-[#0a1f45]"
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
                  Pilih materi (radio) untuk dokumen yang berbasis 1 topik (RPP, Modul, LKPD, dst).
                  Dokumen ATP/PROTA/PROSEM/TP/KKTP menggunakan seluruh baris.
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
                    <th className="border border-slate-200 px-2 py-2 w-16">Pilih</th>
                    <th className="border border-slate-200 px-2 py-2 w-10">No</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[180px]">Materi/Topik</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[220px]">Kompetensi/Tujuan Utama</th>
                    <th className="border border-slate-200 px-2 py-2 w-24">Pertemuan</th>
                    <th className="border border-slate-200 px-2 py-2 min-w-[140px]">Alokasi JP</th>
                    <th className="border border-slate-200 px-2 py-2 w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t, i) => (
                    <tr key={i} className="align-top">
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <input
                          type="radio"
                          name="topic-select"
                          checked={selectedTopicNo === t.no}
                          onChange={() => setSelectedTopicNo(t.no)}
                        />
                      </td>
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
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTopic(i)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Doc chooser */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800">Pilih Dokumen yang Akan Dibuat</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DOC_TYPES.map((d) => (
                  <label key={d} className="flex items-start gap-2 rounded-md border border-slate-200 p-2 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={selectedDocs.has(d)}
                      onCheckedChange={() => toggleDoc(d)}
                    />
                    <div className="text-sm">
                      <div className="font-medium text-slate-800">{DOC_LABELS[d]}</div>
                      {TOPIC_SCOPED.includes(d) && (
                        <div className="text-xs text-slate-500">butuh 1 materi terpilih</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={handleGenerateSelected}
                  disabled={generatingDoc !== null || generatingAll}
                  className="bg-[#0f2b5b] hover:bg-[#0a1f45]"
                >
                  {generatingDoc && !generatingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Membuat {generatingDoc}...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Terpilih ({selectedDocs.size})
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateAll}
                  disabled={generatingAll || generatingDoc !== null}
                  className="border-[#0f2b5b] text-[#0f2b5b]"
                >
                  {generatingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {generatingDoc ? `Membuat ${generatingDoc}...` : "Menyusun..."}
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-4 w-4" />
                      Generate Semua Administrasi
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>
        )}

        {generatedList.length > 0 && (
          <section id="docs-result" className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Preview Dokumen</h2>
                <p className="text-sm text-slate-500">
                  Preview gratis. Unduhan membutuhkan token
                  {hasAccess ? " — token aktif untuk mapel ini." : "."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownloadAll("docx")}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Download Semua (DOCX)
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadAll("pdf")}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Download Semua (PDF)
                </Button>
              </div>
            </div>

            {/* Doc tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
              {generatedList.map((d) => (
                <button
                  key={d}
                  onClick={() => setActiveTab(d)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    currentTab === d
                      ? "border-[#0f2b5b] bg-[#0f2b5b] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {DOC_LABELS[d]}
                </button>
              ))}
            </div>

            {currentTab && (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(currentTab, "docx")}>
                    <FileType className="mr-1.5 h-4 w-4" /> DOCX
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(currentTab, "pdf")}>
                    <Download className="mr-1.5 h-4 w-4" /> PDF
                  </Button>
                </div>
                <article className="rpp-doc rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{docs[currentTab] ?? ""}</ReactMarkdown>
                </article>
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 pb-6 text-center text-xs text-slate-400 print:hidden">
          Generator Administrasi Pembelajaran
        </footer>
      </main>

      {/* Paket / token modal */}
      <Dialog open={tokenOpen} onOpenChange={setTokenOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Aktifkan Paket Administrasi
            </DialogTitle>
            <DialogDescription>
              Rp49.000 / Mata Pelajaran / Semester. Bayar sekali untuk mengakses dan mendownload
              seluruh Administrasi Pembelajaran mapel ini selama semester yang dipilih.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-2xl font-bold text-[#0f2b5b]">Rp49.000</div>
              <div className="mt-1 text-slate-600">
                Mata Pelajaran: <b>{form.mapel || "-"}</b>
              </div>
              <div className="text-slate-600">
                Semester: <b>{form.semester || "-"}</b>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">Metode Pembayaran</div>
              <div className="flex flex-wrap gap-2">
                {(["Transfer Superbank", "GoPay", "DANA"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      payMethod === m
                        ? "border-[#0f2b5b] bg-[#0f2b5b] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                {payMethod === "Transfer Superbank" && (
                  <div className="space-y-2 text-sm">
                    <div className="text-slate-600">Transfer Superbank — Nomor Rekening:</div>
                    <div className="font-mono text-lg font-bold tracking-wider text-slate-900">
                      000083324947
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText("000083324947");
                        toast.success("Nomor rekening disalin.");
                      }}
                    >
                      Salin Nomor Rekening
                    </Button>
                  </div>
                )}
                {payMethod !== "Transfer Superbank" && (
                  <div className="flex flex-col items-center gap-2 text-sm">
                    <div className="text-slate-600">
                      Pindai QR {payMethod} berikut, lalu bayar Rp49.000.
                    </div>
                    <img
                      src={payMethod === "GoPay" ? "/qr-gopay.png" : "/qr-dana.png"}
                      alt={`QR ${payMethod}`}
                      className="w-64 max-w-full rounded-md border border-slate-200 bg-white p-2"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const n = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (n) n.style.display = "block";
                      }}
                    />
                    <div className="hidden text-xs text-red-600">
                      Gambar QR {payMethod} belum tersedia. Unggah file{" "}
                      <b>{payMethod === "GoPay" ? "public/qr-gopay.png" : "public/qr-dana.png"}</b>.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-slate-700">
              Setelah melakukan pembayaran Rp49.000, kirim bukti pembayaran melalui WhatsApp untuk
              mendapatkan token aktivasi.
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" /> Saya Sudah Bayar – Minta Token
              </a>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="text-sm font-semibold text-slate-800">Sudah punya token?</div>
              <Input
                placeholder="Contoh: ADM-XXXX-XXXX"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleVerifyToken} disabled={verifying} className="bg-[#0f2b5b] hover:bg-[#0a1f45]">
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aktifkan Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
