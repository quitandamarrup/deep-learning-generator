import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askAI } from "./ai/ai.service";

const RppInput = z.object({
  penyusun: z.string().min(1),
  satuan: z.string().min(1),
  tahunAjaran: z.string().min(1),
  semester: z.string().min(1),
  jenjang: z.string().min(1),
  kelas: z.string().min(1),
  fase: z.string().min(1),
  mapel: z.string().min(1),
  materi: z.string().min(1),
  alokasi: z.string().min(1),
  pertemuan: z.string().min(1),
  cp: z.string().min(1),
  info: z.string().optional().default(""),
});

export type RppInputType = z.infer<typeof RppInput>;

export const generateRPP = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RppInput.parse(data))
  .handler(async ({ data }) => {
    const system = `Anda adalah asisten ahli kurikulum Indonesia yang membuat Rencana Pelaksanaan Pembelajaran (RPP) / Perencanaan Pembelajaran Mendalam.
Ikuti kerangka Pembelajaran Mendalam: Mindful, Meaningful, Joyful.
Tulis dalam Bahasa Indonesia formal, profesional, dan kontekstual sesuai jenjang, mata pelajaran, dan materi.
Keluarkan HANYA Markdown yang rapi menggunakan heading (##, ###), bullet, dan tabel Markdown untuk rubrik.
Jangan mengarang Capaian Pembelajaran resmi jika pengguna tidak memberikannya — gunakan CP yang diberikan pengguna apa adanya.
Pilih SATU model pembelajaran utama yang paling sesuai (Discovery / PBL / PjBL / Inquiry / Cooperative / Direct Instruction / lainnya) — jangan selalu sama.
Pastikan total alokasi waktu Kegiatan Awal + Inti + Penutup sama dengan alokasi waktu pengguna.
Jika jumlah pertemuan > 1, buat kegiatan terpisah untuk setiap pertemuan.
Aktivitas Mindful/Meaningful/Joyful harus terlihat konkret, bukan sekadar label.
Pastikan alur: CP → Tujuan Pembelajaran → Aktivitas → Asesmen → Tindak Lanjut konsisten.`;

    const prompt = `Buat RPP Pembelajaran Mendalam lengkap dengan struktur PERSIS berikut (gunakan heading ## untuk setiap bagian utama A–J):

Data input dari guru:
- Penyusun: ${data.penyusun}
- Satuan Pendidikan: ${data.satuan}
- Tahun Ajaran: ${data.tahunAjaran}
- Semester: ${data.semester}
- Jenjang: ${data.jenjang}
- Kelas: ${data.kelas}
- Fase: ${data.fase}
- Mata Pelajaran: ${data.mapel}
- Materi/Topik: ${data.materi}
- Alokasi Waktu: ${data.alokasi}
- Jumlah Pertemuan: ${data.pertemuan}
- Capaian Pembelajaran: ${data.cp}
- Informasi tambahan: ${data.info || "-"}

Struktur wajib:
## A. IDENTITAS (tabel/daftar semua field di atas termasuk Kelas/Fase gabungan)
## B. IDENTIFIKASI
### 1. Identifikasi Peserta Didik (Pengetahuan Awal, Minat Belajar, Kebutuhan Belajar — beri tanda "*perkiraan awal*" jika tanpa data diagnostik)
### 2. Materi Pembelajaran (Faktual, Konseptual, Prosedural, Metakognitif)
### 3. Dimensi Profil Lulusan (pilih hanya yang relevan, jelaskan penerapan)
## C. DESAIN PEMBELAJARAN
### 1. Capaian Pembelajaran
### 2. Lintas Disiplin Ilmu
### 3. Tujuan Pembelajaran (spesifik, terukur, selaras CP)
### 4. Topik Pembelajaran
### 5. Praktik Pedagogis (Pendekatan Pembelajaran Mendalam; Model terpilih + Alasan + Sintaks; Metode)
### 6. Kemitraan Pembelajaran
### 7. Lingkungan Pembelajaran
### 8. Pemanfaatan Digital
## D. PENGALAMAN BELAJAR
Untuk setiap pertemuan (jika > 1, buat "### Pertemuan ke-N"):
#### 1. Kegiatan Awal (pembukaan, kesiapan, apersepsi, aktivasi pengetahuan awal, motivasi, penyampaian tujuan) — sebutkan penerapan Mindful/Meaningful/Joyful.
#### 2. Kegiatan Inti — WAJIB tiga sub-tahap: **MEMAHAMI**, **MENGAPLIKASI**, **MEREFLEKSI**. Integrasikan sintaks model. Untuk setiap tahap sajikan tabel Markdown kolom: Aktivitas Guru | Aktivitas Peserta Didik | Media/Sumber | Alokasi Waktu.
#### 3. Kegiatan Penutup (penguatan, umpan balik, tindak lanjut, informasi pertemuan berikutnya, penutup).
Pastikan total menit = alokasi waktu.
## E. ASESMEN PEMBELAJARAN
### 1. Asesmen Awal/Diagnostik (Jenis, Bentuk, Teknik, Instrumen/contoh pertanyaan)
### 2. Asesmen Proses/Formatif (Jenis, Bentuk, Teknik, Instrumen, Indikator)
### 3. Asesmen Akhir (Jenis, Bentuk, Teknik, Instrumen, Kriteria ketercapaian)
## F. RUBRIK PENILAIAN
Tabel Markdown: Aspek | Sangat Baik | Baik | Cukup | Perlu Bimbingan — deskriptor observable.
## G. TINDAK LANJUT
### Remedial
### Pengayaan
## H. REFLEKSI
### Refleksi Peserta Didik
### Refleksi Guru
## I. LAMPIRAN
Sebutkan: LKPD ringkas, bahan ajar ringkas, instrumen asesmen, rubrik, kunci jawaban/pedoman penskoran, lembar refleksi (isi ringkas & relevan).
## J. PENGESAHAN
Format dua kolom (gunakan tabel Markdown 2 kolom):
Kolom kiri: "Mengetahui,\\nKepala Satuan Pendidikan\\n\\n\\n(...........................)\\nNIP. ......................."
Kolom kanan: "[Tempat], [Tanggal]\\nGuru Mata Pelajaran/Kelas\\n\\n\\n(${data.penyusun})\\nNIP. ......................."

Keluarkan hanya konten Markdown, tanpa pembuka atau penutup.`;

    const { text } = await askAI({ system, prompt });

    return { markdown: text };
  });
