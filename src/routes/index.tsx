import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateRPP, type RppInputType } from "@/lib/rpp.functions";
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
import { Loader2, Copy, Printer, Download, RefreshCw, Pencil, FileText } from "lucide-react";

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
  const [form, setForm] = useState<RppInputType>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [editing, setEditing] = useState(false);

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
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                Generator RPP Pembelajaran Mendalam
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Buat perencanaan pembelajaran yang sistematis, kontekstual, dan sesuai kebutuhan
                peserta didik.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7 print:hidden">
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
            <Field label="Alokasi Waktu">
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
