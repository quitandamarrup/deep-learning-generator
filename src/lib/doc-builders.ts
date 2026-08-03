import type { DocContextType, DocType } from "./admin-docs.functions";
import type { MasterData, MasterTopic, MasterActivity } from "./cp-analysis.functions";

/**
 * Render 13 dokumen administrasi secara lokal dari Master Data hasil satu kali Analisis CP.
 * Tidak memanggil AI sama sekali.
 */

const li = (arr: string[] | undefined, fallback = "-") =>
  arr && arr.length ? arr.map((x) => `- ${x}`).join("\n") : `- ${fallback}`;

const ol = (arr: string[] | undefined, fallback = "-") =>
  arr && arr.length ? arr.map((x, i) => `${i + 1}. ${x}`).join("\n") : `1. ${fallback}`;

const cell = (v: string | number | undefined) =>
  String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ")
    .trim() || "-";

function table(headers: string[], rows: (string | number)[][]) {
  const head = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |`;
  if (!rows.length) return `${head}\n| ${headers.map(() => "-").join(" | ")} |`;
  return `${head}\n${rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")}`;
}

function activityTable(rows: MasterActivity[]) {
  return table(
    ["Aktivitas Guru", "Aktivitas Peserta Didik", "Media/Sumber", "Alokasi"],
    rows.map((a) => [a.guru, a.siswa, a.media, a.alokasi]),
  );
}

function pickTopic(master: MasterData, ctx: DocContextType): MasterTopic {
  const no = ctx.selectedTopicNo;
  return (no ? master.topics.find((t) => t.no === no) : undefined) ?? master.topics[0];
}

function identitas(ctx: DocContextType, t?: MasterTopic) {
  const rows: [string, string][] = [
    ["Penyusun", ctx.penyusun],
    ["Satuan Pendidikan", ctx.satuan],
    ["Tahun Ajaran", ctx.tahunAjaran],
    ["Semester", ctx.semester],
    ["Jenjang", ctx.jenjang],
    ["Kelas / Fase", `${ctx.kelas} / ${ctx.fase}`],
    ["Mata Pelajaran", ctx.mapel],
  ];
  if (t) {
    rows.push(["Materi/Topik", t.materi]);
    rows.push(["Jumlah Pertemuan", String(t.pertemuan)]);
    rows.push(["Alokasi Waktu", t.alokasi]);
  }
  rows.push(["Alokasi JP per Pertemuan", ctx.alokasiPerPertemuan]);
  if (ctx.info) rows.push(["Informasi Tambahan", ctx.info]);
  return table(
    ["Komponen", "Keterangan"],
    rows.map(([a, b]) => [a, b]),
  );
}

function pengesahan(ctx: DocContextType) {
  const principalLine = ctx.principalName
    ? `(${ctx.principalName})<br>NIP. ${ctx.principalNip || "......................."}`
    : "(...........................)<br>NIP. .......................";
  const guruLine = `(${ctx.penyusun})<br>NIP. ${ctx.nip || "......................."}`;
  return `## J. PENGESAHAN

${table(
  [
    "Mengetahui,<br>Kepala Satuan Pendidikan",
    `${ctx.satuan}, ......................<br>Guru Mata Pelajaran`,
  ],
  [[`<br><br>${principalLine}`, `<br><br>${guruLine}`]],
)}`;
}

function allTp(master: MasterData) {
  return master.topics.flatMap((t) => t.tp.map((tp) => ({ topic: t, tp })));
}

/* ---------------- builders ---------------- */

function buildTP(m: MasterData, ctx: DocContextType) {
  const body = m.topics
    .map(
      (t) =>
        `### Topik ${t.no}: ${t.materi}\n\n${t.tp
          .map(
            (tp) =>
              `${tp.kode}. ${tp.rumusan}${tp.indikator ? `\n   - Indikator: ${tp.indikator}` : ""}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
  return `## Tujuan Pembelajaran — ${ctx.mapel} ${ctx.kelas}\n\n${identitas(ctx)}\n\n${body}`;
}

function buildATP(m: MasterData, ctx: DocContextType) {
  const rows = allTp(m).map(({ topic, tp }, i) => [
    i + 1,
    tp.kode,
    tp.rumusan,
    topic.materi,
    `${topic.pertemuan} pertemuan (${topic.alokasi})`,
    ctx.semester,
    tp.level,
  ]);
  return `## Alur Tujuan Pembelajaran (ATP) — ${ctx.mapel} ${ctx.kelas} / Fase ${ctx.fase}\n\n${table(
    ["No", "Kode TP", "Rumusan TP", "Materi/Topik", "Alokasi", "Semester", "Keterangan"],
    rows,
  )}`;
}

function buildPROTA(m: MasterData, ctx: DocContextType) {
  const rows = m.topics.map((t) => [
    ctx.semester,
    t.no,
    t.materi,
    `${t.pertemuan} pertemuan`,
    t.alokasi,
    t.kompetensi,
  ]);
  const totalPertemuan = m.topics.reduce((a, t) => a + t.pertemuan, 0);
  return `## Program Tahunan (PROTA) — ${ctx.mapel} ${ctx.kelas} | TA ${ctx.tahunAjaran}\n\n${table(
    ["Semester", "No", "Materi/Topik", "Alokasi Pertemuan", "Alokasi JP", "Keterangan"],
    rows,
  )}\n\n**Total pertemuan semester ${ctx.semester}: ${totalPertemuan} pertemuan.**`;
}

function buildPROSEM(m: MasterData, ctx: DocContextType) {
  const weeks = 24; // 6 bulan x 4 minggu
  const headers = ["No", "Materi/Topik", "Jml Pertemuan", "Alokasi JP"];
  for (let b = 1; b <= 6; b++) for (let w = 1; w <= 4; w++) headers.push(`B${b}M${w}`);
  let cursor = 0;
  const rows = m.topics.map((t) => {
    const marks: string[] = Array.from({ length: weeks }, () => "");
    for (let i = 0; i < t.pertemuan && cursor < weeks; i++, cursor++) marks[cursor] = "✓";
    return [t.no, t.materi, t.pertemuan, t.alokasi, ...marks];
  });
  return `## Program Semester (PROSEM) — ${ctx.mapel} ${ctx.kelas} | Semester ${ctx.semester}\n\n${table(
    headers,
    rows,
  )}\n\n*Keterangan: B = Bulan ke-, M = Minggu ke-. Distribusi dapat disesuaikan dengan kalender pendidikan satuan.*`;
}

function buildKKTP(m: MasterData, ctx: DocContextType) {
  const rows = allTp(m).map(({ topic, tp }) => [
    tp.kode,
    tp.rumusan,
    tp.kktp || `Peserta didik mampu ${tp.rumusan.toLowerCase()}`,
    tp.indikator,
    "Tes / Observasi / Unjuk Kerja",
    `Soal, rubrik, dan lembar observasi topik ${topic.no}`,
  ]);
  return `## Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) — ${ctx.mapel} ${ctx.kelas}\n\n${table(
    ["Kode TP", "Rumusan TP", "Kriteria Ketercapaian", "Indikator", "Teknik", "Instrumen"],
    rows,
  )}`;
}

function pengalamanBelajar(t: MasterTopic) {
  return t.pertemuanRinci
    .map(
      (p) => `### Pertemuan ke-${p.pertemuan}

#### 1. Kegiatan Awal
${ol(p.awal)}

#### 2. Kegiatan Inti

**MEMAHAMI**

${activityTable(p.memahami)}

**MENGAPLIKASI**

${activityTable(p.mengaplikasi)}

**MEREFLEKSI**

${activityTable(p.merefleksi)}

#### 3. Kegiatan Penutup
${ol(p.penutup)}`,
    )
    .join("\n\n");
}

function rubrikTable(t: MasterTopic) {
  return table(
    ["Jenis", "Aspek", "Sangat Baik (4)", "Baik (3)", "Cukup (2)", "Perlu Bimbingan (1)"],
    t.rubrik.map((r) => [r.jenis, r.aspek, r.sangatBaik, r.baik, r.cukup, r.perluBimbingan]),
  );
}

function buildRPP(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  return `## A. IDENTITAS

${identitas(ctx, t)}

## B. IDENTIFIKASI

### 1. Identifikasi Peserta Didik
- Pengetahuan Awal: ${t.pengetahuanAwal || "-"}
- Minat Belajar: ${t.minatBelajar || "-"}
- Kebutuhan Belajar: ${t.kebutuhanBelajar || "-"}

### 2. Materi Pembelajaran
- Faktual: ${t.materiFaktual || "-"}
- Konseptual: ${t.materiKonseptual || "-"}
- Prosedural: ${t.materiProsedural || "-"}
- Metakognitif: ${t.materiMetakognitif || "-"}

### 3. Dimensi Profil Lulusan
${li(t.dimensiProfil.map((d) => `**${d.dimensi}** — ${d.penerapan}`))}

## C. DESAIN PEMBELAJARAN

### 1. Capaian Pembelajaran
${ctx.cp}

### 2. Lintas Disiplin Ilmu
${t.lintasDisiplin || "-"}

### 3. Tujuan Pembelajaran
${t.tp.map((tp) => `- ${tp.kode}: ${tp.rumusan}`).join("\n")}

### 4. Topik Pembelajaran
${t.materi} — ${t.kompetensi}

### 5. Praktik Pedagogis
- Pendekatan: Pembelajaran Mendalam (Mindful, Meaningful, Joyful)
- Model: **${t.model}** — ${t.alasanModel}
- Sintaks:
${li(t.sintaks)}
- Metode: ${t.metode || "-"}

### 6. Kemitraan Pembelajaran
${t.kemitraan || "-"}

### 7. Lingkungan Pembelajaran
${t.lingkungan || "-"}

### 8. Pemanfaatan Digital
${t.digital || "-"}

## D. PENGALAMAN BELAJAR

${pengalamanBelajar(t)}

## E. ASESMEN PEMBELAJARAN

### 1. Asesmen Awal/Diagnostik
${table(
  ["No", "Pertanyaan", "Kunci/Indikator"],
  t.asesmen.diagnostik.map((d, i) => [i + 1, d.soal, d.kunci]),
)}

### 2. Asesmen Proses/Formatif
${table(
  ["Aspek", "Indikator", "Teknik", "Instrumen"],
  t.asesmen.formatif.map((d) => [d.aspek, d.indikator, d.teknik, d.instrumen]),
)}

### 3. Asesmen Akhir/Sumatif
${table(
  ["No", "Soal", "Kunci", "Skor"],
  t.asesmen.sumatif.map((d, i) => [i + 1, d.soal, d.kunci, d.skor]),
)}

## F. RUBRIK PENILAIAN

${rubrikTable(t)}

## G. TINDAK LANJUT

### Remedial
${t.remedial || "-"}

### Pengayaan
${t.pengayaan || "-"}

## H. REFLEKSI

### Refleksi Peserta Didik
${li(t.refleksiSiswa)}

### Refleksi Guru
${li(t.refleksiGuru)}

## I. LAMPIRAN
- LKPD topik "${t.materi}"
- Bahan ajar / materi ringkas
- Instrumen asesmen diagnostik, formatif, sumatif
- Rubrik penilaian & pedoman penskoran
- Lembar refleksi

${pengesahan(ctx)}`;
}

function buildMODUL(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  return `## Informasi Umum

${identitas(ctx, t)}

## Kompetensi Awal
${t.pengetahuanAwal || "-"}

## Profil Pelajar Pancasila
${li(t.dimensiProfil.map((d) => `**${d.dimensi}** — ${d.penerapan}`))}

## Sarana dan Prasarana
${t.lingkungan || "-"} ${t.digital ? `\n- Pemanfaatan digital: ${t.digital}` : ""}

## Target Peserta Didik
Peserta didik ${ctx.kelas} (Fase ${ctx.fase}) reguler. Kebutuhan belajar: ${t.kebutuhanBelajar || "-"}

## Model Pembelajaran
**${t.model}** — ${t.alasanModel}
${li(t.sintaks)}

## Komponen Inti

### Tujuan Pembelajaran
${t.tp.map((tp) => `- ${tp.kode}: ${tp.rumusan}`).join("\n")}

### Pemahaman Bermakna
${t.pemahamanBermakna || "-"}

### Pertanyaan Pemantik
${li(t.pertanyaanPemantik)}

### Persiapan Pembelajaran
${li(t.lkpd.alatBahan, "Menyiapkan LKPD, bahan ajar, dan instrumen asesmen")}

### Kegiatan Pembelajaran

${pengalamanBelajar(t)}

### Asesmen
- Diagnostik: ${t.asesmen.diagnostik.length} pertanyaan
- Formatif: observasi & unjuk kerja
- Sumatif: ${t.asesmen.sumatif.length} soal

${table(
  ["No", "Soal Sumatif", "Kunci", "Skor"],
  t.asesmen.sumatif.map((d, i) => [i + 1, d.soal, d.kunci, d.skor]),
)}

### Pengayaan dan Remedial
- Pengayaan: ${t.pengayaan || "-"}
- Remedial: ${t.remedial || "-"}

### Refleksi Guru dan Peserta Didik
**Guru**
${li(t.refleksiGuru)}

**Peserta Didik**
${li(t.refleksiSiswa)}

## Lampiran

### LKPD (ringkas)
${ol(t.lkpd.langkah)}

### Bahan Bacaan
${li(t.uraianMateri.map((u) => `${u.judul}: ${u.isi}`))}

### Glosarium
${table(
  ["Istilah", "Arti"],
  t.glosarium.map((g) => [g.istilah, g.arti]),
)}

### Daftar Pustaka
${li(t.daftarPustaka)}`;
}

function buildMATERI(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  return `# Materi Ajar: ${t.materi}

${identitas(ctx, t)}

## Pendahuluan
${t.pemahamanBermakna || t.kompetensi}

Tujuan pembelajaran yang ingin dicapai:
${t.tp.map((tp) => `- ${tp.kode}: ${tp.rumusan}`).join("\n")}

## Peta Konsep
${li(t.petaKonsep)}

## Uraian Materi
${t.uraianMateri.map((u, i) => `### ${i + 1}. ${u.judul}\n\n${u.isi}`).join("\n\n")}

## Rangkuman
${t.rangkuman || "-"}

## Refleksi
${li(t.refleksiSiswa)}

## Glosarium
${table(
  ["Istilah", "Arti"],
  t.glosarium.map((g) => [g.istilah, g.arti]),
)}

## Daftar Pustaka
${li(t.daftarPustaka)}`;
}

function buildLKPD(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  return `# LKPD — ${t.materi}

## Identitas
${table(
  ["Komponen", "Isian"],
  [
    ["Nama", "................................"],
    ["Kelas", ctx.kelas],
    ["Kelompok", "................................"],
    ["Mata Pelajaran", ctx.mapel],
    ["Hari/Tanggal", "................................"],
  ],
)}

## Tujuan Pembelajaran
${t.tp.map((tp) => `- ${tp.kode}: ${tp.rumusan}`).join("\n")}

## Petunjuk
1. Bacalah seluruh langkah kegiatan sebelum mengerjakan.
2. Kerjakan bersama kelompok secara aktif dan bertanggung jawab.
3. Tanyakan kepada guru jika terdapat hal yang belum dipahami.

## Alat dan Bahan
${li(t.lkpd.alatBahan)}

## Langkah Kegiatan
${ol(t.lkpd.langkah)}

## Pertanyaan Diskusi
${ol(t.lkpd.pertanyaan)}

## Kesimpulan
....................................................................................................

....................................................................................................

## Refleksi Belajar
${li(t.refleksiSiswa)}`;
}

function buildASESMEN(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  const total = t.asesmen.sumatif.reduce((a, s) => a + (s.skor || 0), 0) || 100;
  return `# Instrumen Asesmen — ${t.materi}

${identitas(ctx, t)}

## Asesmen Diagnostik
${table(
  ["No", "Pertanyaan", "Kunci/Indikator"],
  t.asesmen.diagnostik.map((d, i) => [i + 1, d.soal, d.kunci]),
)}

## Asesmen Formatif
${table(
  ["Aspek", "Indikator", "Teknik", "Instrumen"],
  t.asesmen.formatif.map((d) => [d.aspek, d.indikator, d.teknik, d.instrumen]),
)}

## Asesmen Sumatif
${table(
  ["No", "Soal", "Kunci Jawaban", "Skor"],
  t.asesmen.sumatif.map((d, i) => [i + 1, d.soal, d.kunci, d.skor]),
)}

**Total skor: ${total}. Nilai akhir = (skor perolehan / ${total}) × 100.**`;
}

function buildKISI(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  return `# Kisi-Kisi Soal — ${t.materi}

${identitas(ctx, t)}

${table(
  [
    "No",
    "Kode TP",
    "Indikator Soal",
    "Materi",
    "Level Kognitif",
    "Bentuk Soal",
    "No Soal",
    "Bobot",
  ],
  t.kisi.map((k, i) => [
    i + 1,
    k.kodeTp,
    k.indikator,
    k.materi,
    k.level,
    k.bentuk,
    k.nomor,
    k.bobot,
  ]),
)}`;
}

function buildSOAL(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  const pg = t.soal.pg
    .map((p) => `${p.no}. ${p.soal}\n${p.opsi.map((o) => `   ${o}`).join("\n")}`)
    .join("\n\n");
  const ur = t.soal.uraian.map((p) => `${p.no}. ${p.soal}`).join("\n\n");
  const totalPg = t.soal.pg.length;
  const totalUr = t.soal.uraian.reduce((a, s) => a + (s.skor || 0), 0);
  return `# Soal — ${t.materi}

${identitas(ctx, t)}

## Petunjuk
1. Tulis identitas pada lembar jawaban.
2. Kerjakan soal yang dianggap mudah terlebih dahulu.
3. Periksa kembali jawaban sebelum dikumpulkan.

## A. Pilihan Ganda

${pg || "-"}

## B. Uraian

${ur || "-"}

## Kunci Jawaban dan Pedoman Penskoran

### Pilihan Ganda
${table(
  ["No", "Kunci", "Skor"],
  t.soal.pg.map((p) => [p.no, p.kunci, 1]),
)}

### Uraian
${table(
  ["No", "Kunci/Rubrik Jawaban", "Skor"],
  t.soal.uraian.map((p) => [p.no, p.kunci, p.skor]),
)}

**Total skor: ${totalPg + totalUr}. Nilai akhir = (skor perolehan / ${totalPg + totalUr || 1}) × 100.**`;
}

function buildRUBRIK(m: MasterData, ctx: DocContextType) {
  const t = pickTopic(m, ctx);
  const jenis = Array.from(new Set(t.rubrik.map((r) => r.jenis || "Penilaian")));
  const body = jenis
    .map(
      (j) =>
        `## Rubrik ${j}\n\n${table(
          ["Aspek", "Sangat Baik (4)", "Baik (3)", "Cukup (2)", "Perlu Bimbingan (1)"],
          t.rubrik
            .filter((r) => (r.jenis || "Penilaian") === j)
            .map((r) => [r.aspek, r.sangatBaik, r.baik, r.cukup, r.perluBimbingan]),
        )}`,
    )
    .join("\n\n");
  return `# Rubrik Penilaian — ${t.materi}

${identitas(ctx, t)}

${body}

## Pedoman Penskoran
Nilai akhir = (jumlah skor perolehan / (4 × jumlah aspek)) × 100.

${table(
  ["Rentang Nilai", "Predikat"],
  [
    ["86 – 100", "Sangat Baik"],
    ["71 – 85", "Baik"],
    ["56 – 70", "Cukup"],
    ["< 56", "Perlu Bimbingan"],
  ],
)}`;
}

const BUILDERS: Record<DocType, (m: MasterData, ctx: DocContextType) => string> = {
  RPP: buildRPP,
  TP: buildTP,
  ATP: buildATP,
  PROTA: buildPROTA,
  PROSEM: buildPROSEM,
  KKTP: buildKKTP,
  MODUL: buildMODUL,
  MATERI: buildMATERI,
  LKPD: buildLKPD,
  ASESMEN: buildASESMEN,
  KISI: buildKISI,
  SOAL: buildSOAL,
  RUBRIK: buildRUBRIK,
};

/** Sinkronkan master dengan hasil edit tabel topik (materi/pertemuan/alokasi/kompetensi). */
export function syncMaster(
  master: MasterData,
  topics: { no: number; materi: string; kompetensi: string; pertemuan: number; alokasi: string }[],
): MasterData {
  const byMateri = new Map(master.topics.map((t) => [t.no, t]));
  return {
    ...master,
    topics: topics.map((t, i) => {
      const base = byMateri.get(t.no) ?? master.topics[i] ?? master.topics[0];
      return { ...base, ...t };
    }),
  };
}

export function buildDocFromMaster(
  docType: DocType,
  master: MasterData,
  ctx: DocContextType,
): string {
  return BUILDERS[docType](master, ctx);
}
