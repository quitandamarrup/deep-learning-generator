import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const DOC_TYPES = [
  "RPP",
  "TP",
  "ATP",
  "PROTA",
  "PROSEM",
  "KKTP",
  "MODUL",
  "MATERI",
  "LKPD",
  "ASESMEN",
  "KISI",
  "SOAL",
  "RUBRIK",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_LABELS: Record<DocType, string> = {
  RPP: "RPP / Perencanaan Pembelajaran Mendalam",
  TP: "Tujuan Pembelajaran (TP)",
  ATP: "Alur Tujuan Pembelajaran (ATP)",
  PROTA: "Program Tahunan (PROTA)",
  PROSEM: "Program Semester (PROSEM)",
  KKTP: "Kriteria Ketercapaian TP (KKTP)",
  MODUL: "Modul Ajar",
  MATERI: "Materi / Bahan Ajar",
  LKPD: "LKPD",
  ASESMEN: "Asesmen",
  KISI: "Kisi-Kisi",
  SOAL: "Soal",
  RUBRIK: "Rubrik Penilaian",
};

const TopicSchema = z.object({
  no: z.number(),
  materi: z.string(),
  kompetensi: z.string(),
  pertemuan: z.number(),
  alokasi: z.string(),
});

const ContextSchema = z.object({
  penyusun: z.string().min(1),
  satuan: z.string().min(1),
  tahunAjaran: z.string().min(1),
  semester: z.string().min(1),
  jenjang: z.string().min(1),
  kelas: z.string().min(1),
  fase: z.string().min(1),
  mapel: z.string().min(1),
  cp: z.string().min(1),
  alokasiPerPertemuan: z.string().min(1),
  info: z.string().optional().default(""),
  topics: z.array(TopicSchema).min(1),
  selectedTopicNo: z.number().optional(),
});

export type DocContextType = z.infer<typeof ContextSchema>;

const GenerateInput = z.object({
  docType: z.enum(DOC_TYPES),
  context: ContextSchema,
});

function topicsBlock(ctx: DocContextType) {
  return ctx.topics
    .map(
      (t) =>
        `- (${t.no}) ${t.materi} | Kompetensi: ${t.kompetensi} | ${t.pertemuan} pertemuan | Alokasi: ${t.alokasi}`,
    )
    .join("\n");
}

function selectedTopic(ctx: DocContextType) {
  if (!ctx.selectedTopicNo) return ctx.topics[0];
  return ctx.topics.find((t) => t.no === ctx.selectedTopicNo) ?? ctx.topics[0];
}

function docInstructions(docType: DocType, ctx: DocContextType): string {
  const t = selectedTopic(ctx);
  switch (docType) {
    case "RPP":
      return `Buat RPP Pembelajaran Mendalam untuk topik terpilih: "${t.materi}" (${t.pertemuan} pertemuan, ${t.alokasi}).
Struktur wajib (## heading A–J):
## A. IDENTITAS (tabel semua field)
## B. IDENTIFIKASI (Peserta Didik, Materi F/K/P/M, Dimensi Profil Lulusan)
## C. DESAIN PEMBELAJARAN (CP, Lintas Disiplin, TP, Topik, Praktik Pedagogis + Model + Sintaks, Kemitraan, Lingkungan, Pemanfaatan Digital)
## D. PENGALAMAN BELAJAR — untuk tiap pertemuan (### Pertemuan ke-N): Kegiatan Awal / Inti (tabel: Aktivitas Guru | Peserta Didik | Media | Alokasi, tiga tahap MEMAHAMI/MENGAPLIKASI/MEREFLEKSI) / Penutup. Total menit = ${t.alokasi}.
## E. ASESMEN (Diagnostik, Formatif, Sumatif)
## F. RUBRIK PENILAIAN (tabel: Aspek | Sangat Baik | Baik | Cukup | Perlu Bimbingan)
## G. TINDAK LANJUT (Remedial, Pengayaan)
## H. REFLEKSI (Peserta Didik, Guru)
## I. LAMPIRAN
## J. PENGESAHAN (tabel 2 kolom: Kepala Satuan | Guru ${ctx.penyusun})`;
    case "TP":
      return `Buat daftar Tujuan Pembelajaran (TP) untuk SETIAP topik dari Analisis CP. Format:
## Tujuan Pembelajaran — ${ctx.mapel} ${ctx.kelas}
Untuk tiap topik gunakan sub-heading ### Topik N: <materi>. Di bawahnya daftar TP.N.x bernomor, spesifik, terukur, selaras CP, kata kerja operasional. TP HARUS konsisten untuk dipakai di ATP, RPP, Modul, dan Asesmen.`;
    case "ATP":
      return `Buat Alur Tujuan Pembelajaran (ATP) sebagai tabel Markdown urut logis berbasis semua topik hasil Analisis CP.
Kolom: No | Kode TP | Rumusan TP | Materi/Topik | Alokasi (Pertemuan) | Semester | Keterangan.
TP HARUS sama dengan dokumen TP. Urutkan dari dasar → lanjutan mengikuti urutan topik.`;
    case "PROTA":
      return `Buat Program Tahunan (PROTA) ${ctx.mapel} ${ctx.kelas} TA ${ctx.tahunAjaran}. Tabel Markdown:
Semester | No | Materi/Topik | Alokasi Pertemuan | Alokasi JP | Keterangan.
Gunakan seluruh topik hasil Analisis CP. Distribusikan ke Ganjil/Genap secara proporsional (asumsikan topik yang ada adalah semester ${ctx.semester} kecuali dinyatakan lain; jika hanya cukup untuk 1 semester tulis semester ${ctx.semester}).`;
    case "PROSEM":
      return `Buat Program Semester (PROSEM) semester ${ctx.semester} ${ctx.mapel} ${ctx.kelas}. Tabel Markdown:
No | Materi/Topik | Jml Pertemuan | Alokasi JP | Distribusi Minggu (Bulan 1..Bulan 6, isi centang ✓ pada minggu yang direncanakan).
Baris berdasarkan seluruh topik. Total pertemuan sesuai Analisis CP.`;
    case "KKTP":
      return `Buat KKTP (Kriteria Ketercapaian Tujuan Pembelajaran) untuk seluruh TP dari topik Analisis CP. Tabel Markdown:
Kode TP | Rumusan TP | Kriteria Ketercapaian | Indikator | Teknik | Instrumen.
Kode TP HARUS konsisten dengan dokumen TP.`;
    case "MODUL":
      return `Buat Modul Ajar lengkap untuk topik terpilih "${t.materi}" (${t.pertemuan} pertemuan, ${t.alokasi}).
Bagian: ## Informasi Umum, ## Kompetensi Awal, ## Profil Pelajar Pancasila, ## Sarana Prasarana, ## Target Peserta Didik, ## Model Pembelajaran, ## Komponen Inti (TP, Pemahaman Bermakna, Pertanyaan Pemantik, Persiapan, Kegiatan Pembelajaran per pertemuan, Asesmen, Pengayaan & Remedial, Refleksi Guru & Peserta Didik), ## Lampiran (LKPD ringkas, Bahan Bacaan, Glosarium, Daftar Pustaka).`;
    case "MATERI":
      return `Buat Materi/Bahan Ajar untuk topik "${t.materi}". Bagian: ## Pendahuluan, ## Peta Konsep (bullet hierarkis), ## Uraian Materi (dibagi sub-bab konseptual mendalam, contoh, ilustrasi tekstual), ## Rangkuman, ## Refleksi, ## Daftar Pustaka. Panjang: memadai untuk ${t.pertemuan} pertemuan.`;
    case "LKPD":
      return `Buat LKPD untuk topik "${t.materi}". Bagian: ## Identitas (Nama, Kelas, Kelompok), ## Tujuan Pembelajaran (kutip dari TP topik), ## Petunjuk, ## Alat & Bahan, ## Langkah Kegiatan (bernomor, mengandung MEMAHAMI/MENGAPLIKASI/MEREFLEKSI), ## Pertanyaan Diskusi (min. 5), ## Kesimpulan (ruang isian), ## Refleksi Belajar.`;
    case "ASESMEN":
      return `Buat instrumen Asesmen untuk topik "${t.materi}". Bagian: ## Asesmen Diagnostik (5 pertanyaan + kunci ringkas), ## Asesmen Formatif (rubrik observasi + lembar penilaian), ## Asesmen Sumatif (5 soal + kunci + pedoman skor). Selaras dengan TP topik.`;
    case "KISI":
      return `Buat Kisi-Kisi Soal untuk topik "${t.materi}". Tabel Markdown:
No | Kode TP | Indikator | Materi | Level Kognitif (C1–C6) | Bentuk Soal | Nomor Soal | Bobot. Minimal 10 baris.`;
    case "SOAL":
      return `Buat Soal untuk topik "${t.materi}" sesuai kisi-kisi. Bagian: ## Petunjuk, ## A. Pilihan Ganda (10 nomor + opsi A–E), ## B. Uraian (5 nomor). Lanjutkan dengan ## Kunci Jawaban & Pedoman Penskoran (skor per nomor + total).`;
    case "RUBRIK":
      return `Buat Rubrik Penilaian untuk topik "${t.materi}". Tabel Markdown per jenis asesmen (Pengetahuan, Keterampilan, Sikap). Kolom: Aspek | Sangat Baik (4) | Baik (3) | Cukup (2) | Perlu Bimbingan (1). Deskriptor observable. Sertakan ## Pedoman Penskoran (rumus nilai akhir).`;
  }
}

export const generateDoc = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const ctx = data.context;

    const system = `Anda adalah ahli kurikulum Indonesia yang menyusun Administrasi Pembelajaran (Kurikulum Merdeka / Pembelajaran Mendalam) dalam Bahasa Indonesia formal.
Semua dokumen HARUS konsisten dan mengacu pada sumber yang sama: CP → Analisis CP (Topik) → TP → ATP → PROTA/PROSEM → RPP/Modul → Asesmen.
TP yang muncul di ATP, RPP, Modul, KKTP, Kisi-Kisi, dan Asesmen HARUS identik/selaras (kode TP.N.x konsisten).
Materi pada PROTA/PROSEM HARUS berasal dari daftar Topik Analisis CP. Asesmen mengukur TP yang telah dirumuskan.
Keluarkan HANYA Markdown rapi (heading, bullet, tabel), tanpa penjelasan meta, tanpa fence.`;

    const shared = `KONTEKS BERSAMA (dipakai semua dokumen):
- Penyusun: ${ctx.penyusun}
- Satuan Pendidikan: ${ctx.satuan}
- Tahun Ajaran: ${ctx.tahunAjaran}
- Semester: ${ctx.semester}
- Jenjang: ${ctx.jenjang}
- Kelas / Fase: ${ctx.kelas} / ${ctx.fase}
- Mata Pelajaran: ${ctx.mapel}
- Alokasi JP per pertemuan: ${ctx.alokasiPerPertemuan}
- Capaian Pembelajaran:
${ctx.cp}
- Informasi tambahan: ${ctx.info || "-"}

TOPIK HASIL ANALISIS CP (sumber utama semua dokumen):
${topicsBlock(ctx)}`;

    const prompt = `${shared}

TUGAS: Buat dokumen "${DOC_LABELS[data.docType]}".

${docInstructions(data.docType, ctx)}

Keluarkan hanya konten Markdown final.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
    });
    return { markdown: text };
  });
