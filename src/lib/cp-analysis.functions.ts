import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askAI } from "./ai/ai.service";
import { AiError, classifyAskAIError } from "./ai/ai-errors";
import { buildCacheKey } from "./ai/cache";
import { cpFingerprint } from "./curriculum-fingerprint";

const CpAnalysisInput = z.object({
  jenjang: z.string().min(1),
  kelas: z.string().min(1),
  fase: z.string().min(1),
  mapel: z.string().min(1),
  semester: z.string().min(1),
  cp: z.string().min(1),
  alokasiPerPertemuan: z.string().min(1),
});

export type CpAnalysisInputType = z.infer<typeof CpAnalysisInput>;

export type CpTopic = {
  no: number;
  materi: string;
  kompetensi: string;
  pertemuan: number;
  alokasi: string;
};

/** Master Data Administrasi — hasil SATU kali panggilan AI, dipakai semua dokumen. */
export type MasterActivity = {
  guru: string;
  siswa: string;
  media: string;
  alokasi: string;
};

export type MasterTopic = CpTopic & {
  tp: { kode: string; rumusan: string; indikator: string; kktp: string; level: string }[];
  pemahamanBermakna: string;
  pertanyaanPemantik: string[];
  model: string;
  alasanModel: string;
  sintaks: string[];
  metode: string;
  lintasDisiplin: string;
  dimensiProfil: { dimensi: string; penerapan: string }[];
  materiFaktual: string;
  materiKonseptual: string;
  materiProsedural: string;
  materiMetakognitif: string;
  pengetahuanAwal: string;
  minatBelajar: string;
  kebutuhanBelajar: string;
  kemitraan: string;
  lingkungan: string;
  digital: string;
  uraianMateri: { judul: string; isi: string }[];
  petaKonsep: string[];
  rangkuman: string;
  pertemuanRinci: {
    pertemuan: number;
    awal: string[];
    memahami: MasterActivity[];
    mengaplikasi: MasterActivity[];
    merefleksi: MasterActivity[];
    penutup: string[];
  }[];
  lkpd: { alatBahan: string[]; langkah: string[]; pertanyaan: string[] };
  asesmen: {
    diagnostik: { soal: string; kunci: string }[];
    formatif: { aspek: string; indikator: string; teknik: string; instrumen: string }[];
    sumatif: { soal: string; kunci: string; skor: number }[];
  };
  kisi: {
    kodeTp: string;
    indikator: string;
    materi: string;
    level: string;
    bentuk: string;
    nomor: string;
    bobot: string;
  }[];
  soal: {
    pg: { no: number; soal: string; opsi: string[]; kunci: string }[];
    uraian: { no: number; soal: string; kunci: string; skor: number }[];
  };
  rubrik: {
    jenis: string;
    aspek: string;
    sangatBaik: string;
    baik: string;
    cukup: string;
    perluBimbingan: string;
  }[];
  remedial: string;
  pengayaan: string;
  refleksiGuru: string[];
  refleksiSiswa: string[];
  glosarium: { istilah: string; arti: string }[];
  daftarPustaka: string[];
};

export type MasterData = {
  jenjang: string;
  kelas: string;
  fase: string;
  mapel: string;
  semester: string;
  cp: string;
  alokasiPerPertemuan: string;
  topics: MasterTopic[];
};

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const startObj = text.indexOf("{");
  const endObj = text.lastIndexOf("}");
  if (startObj !== -1 && endObj !== -1) return text.slice(startObj, endObj + 1);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

const S = (v: unknown, fb = "") => (v === undefined || v === null ? fb : String(v));
const A = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function normalizeTopic(raw: any, i: number, alokasiPerPertemuan: string): MasterTopic {
  const pertemuan = Math.max(1, parseInt(S(raw?.pertemuan, "1"), 10) || 1);
  const no = i + 1;
  const materi = S(raw?.materi);
  const tp = A<any>(raw?.tp).map((t, j) => ({
    kode: S(t?.kode, `TP.${no}.${j + 1}`),
    rumusan: S(t?.rumusan),
    indikator: S(t?.indikator),
    kktp: S(t?.kktp),
    level: S(t?.level, "C3"),
  }));
  return {
    no,
    materi,
    kompetensi: S(raw?.kompetensi),
    pertemuan,
    alokasi: S(raw?.alokasi, `${pertemuan} x (${alokasiPerPertemuan})`),
    tp: tp.length
      ? tp
      : [{ kode: `TP.${no}.1`, rumusan: S(raw?.kompetensi), indikator: "", kktp: "", level: "C3" }],
    pemahamanBermakna: S(raw?.pemahamanBermakna),
    pertanyaanPemantik: A<string>(raw?.pertanyaanPemantik).map((x) => S(x)),
    model: S(raw?.model, "Problem Based Learning"),
    alasanModel: S(raw?.alasanModel),
    sintaks: A<string>(raw?.sintaks).map((x) => S(x)),
    metode: S(raw?.metode),
    lintasDisiplin: S(raw?.lintasDisiplin),
    dimensiProfil: A<any>(raw?.dimensiProfil).map((d) => ({
      dimensi: S(d?.dimensi),
      penerapan: S(d?.penerapan),
    })),
    materiFaktual: S(raw?.materiFaktual),
    materiKonseptual: S(raw?.materiKonseptual),
    materiProsedural: S(raw?.materiProsedural),
    materiMetakognitif: S(raw?.materiMetakognitif),
    pengetahuanAwal: S(raw?.pengetahuanAwal),
    minatBelajar: S(raw?.minatBelajar),
    kebutuhanBelajar: S(raw?.kebutuhanBelajar),
    kemitraan: S(raw?.kemitraan),
    lingkungan: S(raw?.lingkungan),
    digital: S(raw?.digital),
    uraianMateri: A<any>(raw?.uraianMateri).map((u) => ({ judul: S(u?.judul), isi: S(u?.isi) })),
    petaKonsep: A<string>(raw?.petaKonsep).map((x) => S(x)),
    rangkuman: S(raw?.rangkuman),
    pertemuanRinci: A<any>(raw?.pertemuanRinci).map((p, k) => ({
      pertemuan: Math.max(1, parseInt(S(p?.pertemuan, String(k + 1)), 10) || k + 1),
      awal: A<string>(p?.awal).map((x) => S(x)),
      memahami: A<any>(p?.memahami).map((a) => ({
        guru: S(a?.guru),
        siswa: S(a?.siswa),
        media: S(a?.media),
        alokasi: S(a?.alokasi),
      })),
      mengaplikasi: A<any>(p?.mengaplikasi).map((a) => ({
        guru: S(a?.guru),
        siswa: S(a?.siswa),
        media: S(a?.media),
        alokasi: S(a?.alokasi),
      })),
      merefleksi: A<any>(p?.merefleksi).map((a) => ({
        guru: S(a?.guru),
        siswa: S(a?.siswa),
        media: S(a?.media),
        alokasi: S(a?.alokasi),
      })),
      penutup: A<string>(p?.penutup).map((x) => S(x)),
    })),
    lkpd: {
      alatBahan: A<string>(raw?.lkpd?.alatBahan).map((x) => S(x)),
      langkah: A<string>(raw?.lkpd?.langkah).map((x) => S(x)),
      pertanyaan: A<string>(raw?.lkpd?.pertanyaan).map((x) => S(x)),
    },
    asesmen: {
      diagnostik: A<any>(raw?.asesmen?.diagnostik).map((d) => ({
        soal: S(d?.soal),
        kunci: S(d?.kunci),
      })),
      formatif: A<any>(raw?.asesmen?.formatif).map((d) => ({
        aspek: S(d?.aspek),
        indikator: S(d?.indikator),
        teknik: S(d?.teknik),
        instrumen: S(d?.instrumen),
      })),
      sumatif: A<any>(raw?.asesmen?.sumatif).map((d) => ({
        soal: S(d?.soal),
        kunci: S(d?.kunci),
        skor: Number(d?.skor) || 10,
      })),
    },
    kisi: A<any>(raw?.kisi).map((k, j) => ({
      kodeTp: S(k?.kodeTp, `TP.${no}.1`),
      indikator: S(k?.indikator),
      materi: S(k?.materi, materi),
      level: S(k?.level, "C3"),
      bentuk: S(k?.bentuk, "Pilihan Ganda"),
      nomor: S(k?.nomor, String(j + 1)),
      bobot: S(k?.bobot, "1"),
    })),
    soal: {
      pg: A<any>(raw?.soal?.pg).map((p, j) => ({
        no: Number(p?.no) || j + 1,
        soal: S(p?.soal),
        opsi: A<string>(p?.opsi).map((x) => S(x)),
        kunci: S(p?.kunci),
      })),
      uraian: A<any>(raw?.soal?.uraian).map((p, j) => ({
        no: Number(p?.no) || j + 1,
        soal: S(p?.soal),
        kunci: S(p?.kunci),
        skor: Number(p?.skor) || 10,
      })),
    },
    rubrik: A<any>(raw?.rubrik).map((r) => ({
      jenis: S(r?.jenis, "Pengetahuan"),
      aspek: S(r?.aspek),
      sangatBaik: S(r?.sangatBaik),
      baik: S(r?.baik),
      cukup: S(r?.cukup),
      perluBimbingan: S(r?.perluBimbingan),
    })),
    remedial: S(raw?.remedial),
    pengayaan: S(raw?.pengayaan),
    refleksiGuru: A<string>(raw?.refleksiGuru).map((x) => S(x)),
    refleksiSiswa: A<string>(raw?.refleksiSiswa).map((x) => S(x)),
    glosarium: A<any>(raw?.glosarium).map((g) => ({ istilah: S(g?.istilah), arti: S(g?.arti) })),
    daftarPustaka: A<string>(raw?.daftarPustaka).map((x) => S(x)),
  };
}

// --- Static instruction blocks, extracted to module-level constants so they ---
// --- are built once per process instead of re-concatenated every request.  ---

const SYSTEM_PROMPT = `Anda adalah ahli kurikulum Indonesia (Kurikulum Merdeka / Pembelajaran Mendalam).
Tugas Anda: menganalisis Capaian Pembelajaran (CP) dan menghasilkan bagian dari MASTER DATA ADMINISTRASI secara bertahap.
Semua tahap HARUS saling konsisten (kode TP sama di semua bagian, materi sama, jumlah pertemuan sama).
Gunakan Bahasa Indonesia formal. Keluarkan HANYA JSON valid tanpa penjelasan dan tanpa markdown fence. Isi setiap field secara padat namun bermakna (kalimat, bukan placeholder).`;

const STAGE_B_QUALITY = `Ketentuan kualitas (jangan gunakan kalimat generik/template, semua harus diturunkan dari CP/kompetensi/topik ini secara spesifik):
- dimensiProfil: pilih HANYA dimensi yang benar-benar relevan dengan kompetensi, mapel, fase, dan aktivitas pembelajaran topik ini (2-3 dimensi, tidak perlu selalu sama/lengkap semua dimensi). "penerapan" wajib menjelaskan secara singkat MENGAPA dimensi itu muncul di topik ini, bukan definisi umum dimensi tersebut.
- lintasDisiplin: sebutkan mata pelajaran/bidang lain yang secara alami mendukung CP topik ini (mis. Bahasa Inggris → TIK/ICT, Kewarganegaraan, Sains, Seni), lengkap dengan bagaimana keterkaitannya. Jangan sebut bidang yang tidak relevan.
- model & sintaks: sintaks HARUS mengikuti tahapan asli dari model pembelajaran yang dipilih (mis. Problem Based Learning: orientasi masalah → organisasi belajar → penyelidikan individu/kelompok → pengembangan & penyajian hasil → analisis & evaluasi; Discovery Learning, Inquiry, PJBL, dan model Pembelajaran Mendalam lain punya tahapan berbeda). Jangan gunakan sintaks generik yang sama untuk setiap topik — pilih model yang paling cocok dengan karakter materi topik ini dan tuliskan sintaks sesuai model tersebut.
- kemitraan, lingkungan, digital: hanya rekomendasikan yang benar-benar mendukung pencapaian TP topik ini (mis. kemitraan: orang tua, perpustakaan, industri, komunitas, guru lain, native speaker, komunitas digital — bukan semua sekaligus; digital: sebutkan alat spesifik seperti Google Docs/Canva/Quizizz/Google Classroom/Padlet dan kaitkan dengan aktivitas mana yang memakainya). Sertakan alasan singkat pemilihannya.
Ketentuan jumlah minimal per topik: pertanyaanPemantik 2–3; sintaks 4–6; dimensiProfil 2–3; petaKonsep 3–6; uraianMateri 3; pertemuanRinci sebanyak nilai "pertemuan" (aktivitas 1–2 baris per tahap); lkpd.pertanyaan 5.
Semua isi field harus terhubung ke TP topik ini yang sudah ditentukan. Jangan mengulang kalimat yang sama antar field atau antar topik.`;

const STAGE_C_QUALITY = `Ketentuan kualitas (jangan gunakan kalimat generik/template, semua harus diturunkan dari CP/TP topik ini secara spesifik):
- asesmen.diagnostik: setiap "soal" mengukur pengetahuan prasyarat spesifik untuk topik ini (bukan soal umum lintas topik); "kunci" memuat juga kriteria keberhasilan singkat, bukan hanya jawaban.
- asesmen.formatif: variasikan teknik antar item (observasi, unjuk kerja, tes lisan, jurnal, dsb.), masing-masing selaras dengan salah satu TP topik ini — jangan ulangi teknik yang sama di semua item.
- asesmen.sumatif: soal harus mencakup seluruh TP topik ini (bukan hanya sebagian), "kunci" memuat pedoman penskoran ringkas.
- remedial: uraikan strategi tindak lanjut berbeda untuk aspek pengetahuan, keterampilan, dan sikap (bukan satu kalimat generik "mengulang materi"), sertakan bentuk pembelajaran lanjutannya.
- pengayaan: rekomendasikan aktivitas bermakna (proyek, riset mini, presentasi, produk digital, kegiatan komunitas) yang relevan dengan topik — bukan sekadar "soal lebih sulit".
- refleksiGuru: pertanyaan reflektif untuk guru tentang proses pembelajaran, keterlibatan murid, ketercapaian TP, dan perbaikan ke depan pada topik ini.
- refleksiSiswa: pertanyaan reflektif untuk murid tentang pemahaman, strategi belajar, tantangan, motivasi, dan rencana perbaikan pada topik ini.
Ketentuan jumlah minimal per topik: asesmen.diagnostik 5; asesmen.formatif 3; asesmen.sumatif 3; kisi 5–8; soal.pg 5; soal.uraian 3; rubrik 4–6 (campur Pengetahuan/Keterampilan/Sikap); refleksi 3.
Semua isi field harus terhubung ke TP topik ini yang sudah ditentukan. Jangan mengulang kalimat yang sama antar field atau antar topik.`;

function dataHeader(data: CpAnalysisInputType): string {
  return `- Jenjang: ${data.jenjang}
- Kelas: ${data.kelas}
- Fase: ${data.fase}
- Mata Pelajaran: ${data.mapel}
- Semester: ${data.semester}
- Alokasi JP per pertemuan: ${data.alokasiPerPertemuan}
- Capaian Pembelajaran:
${data.cp}`;
}

/** Ringkasan topik+TP dari Stage A, dipakai sebagai konteks wajib di Stage B/C (bukan dibuat ulang). */
function topicsContext(
  topics: {
    no: number;
    materi: string;
    kompetensi: string;
    pertemuan: number;
    tp: { kode: string; rumusan: string }[];
  }[],
): string {
  return topics
    .map(
      (t) =>
        `${t.no}. ${t.materi} (kompetensi: ${t.kompetensi}; pertemuan: ${t.pertemuan}; TP: ${t.tp.map((x) => `${x.kode} - ${x.rumusan}`).join(" | ")})`,
    )
    .join("\n");
}

async function runStage<T>(
  label: string,
  input: { system: string; prompt: string; cacheKey: string },
): Promise<{ raw: unknown; ms: number }> {
  const startedAt = Date.now();
  let text: string;
  try {
    ({ text } = await askAI({
      system: input.system,
      prompt: input.prompt,
      cacheKey: input.cacheKey,
      cacheTtlMs: 60 * 60 * 1000, // 1 jam — CP yang sama sering dianalisis ulang dalam satu sesi
      retry: {
        onRetry: (error, attempt, delayMs) => {
          console.error(
            `[analyzeCP:${label}] retry ${attempt} setelah ${delayMs}ms:`,
            error instanceof Error ? error.message : error,
          );
        },
      },
    }));
  } catch (error) {
    throw classifyAskAIError(error);
  }
  const ms = Date.now() - startedAt;
  console.log(`[analyzeCP:${label}] selesai dalam ${ms}ms`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch (cause) {
    throw new AiError(
      "AI_INVALID_JSON",
      `Gagal memproses hasil tahap "${label}" (format JSON tidak valid).`,
      { cause },
    );
  }
  return { raw: parsed, ms };
}

function rawTopicsArray(parsed: unknown): unknown[] {
  const arr = Array.isArray(parsed) ? parsed : (parsed as { topics?: unknown })?.topics;
  return Array.isArray(arr) ? arr : [];
}

export const analyzeCP = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CpAnalysisInput.parse(data))
  .handler(async ({ data }) => {
    const totalStart = Date.now();
    const baseCacheKey = buildCacheKey("cp-analysis", {
      jenjang: data.jenjang,
      kelas: data.kelas,
      fase: data.fase,
      mapel: data.mapel,
      semester: data.semester,
      alokasiPerPertemuan: data.alokasiPerPertemuan,
      cp: cpFingerprint(data.cp),
    });

    // --- Stage A: struktur (kompetensi, topik, estimasi pertemuan, TP) ---
    // Tahap paling ringan dan wajib berhasil dulu — semua tahap berikutnya
    // dibangun di atas hasil ini, bukan menganalisis ulang CP dari nol.
    const stageA = await runStage("struktur", {
      system: SYSTEM_PROMPT,
      cacheKey: `${baseCacheKey}:struktur`,
      prompt: `Analisis CP berikut, bagi menjadi 3–6 materi/topik logis. HANYA hasilkan struktur dasar (kompetensi, topik, estimasi pertemuan, tujuan pembelajaran) — JANGAN membuat materi ajar, aktivitas, atau asesmen di tahap ini.

Data:
${dataHeader(data)}

Keluarkan JSON PERSIS dengan bentuk:
{"topics":[{"no":1,"materi":"Judul topik","kompetensi":"Kompetensi utama topik","pertemuan":2,"alokasi":"2 x (${data.alokasiPerPertemuan})","tp":[{"kode":"TP.1.1","rumusan":"...","indikator":"...","kktp":"kriteria ketercapaian","level":"C3"}]}]}
Ketentuan: tp 2–4 per topik. "pertemuan" proporsional dengan keluasan materi. Urutkan topik dari dasar ke lanjutan. Hanya JSON.`,
    });
    const rawStageATopics = rawTopicsArray(stageA.raw);
    if (rawStageATopics.length === 0)
      throw new AiError("AI_EMPTY_RESULT", "Hasil analisis AI kosong atau tidak berisi topik.");

    // Validasi RAW sebelum normalizeTopic (yang punya fallback) sempat menutupi cacat.
    const invalidRaw = rawStageATopics.find((raw) => {
      const t = raw as { materi?: unknown; pertemuan?: unknown; tp?: unknown };
      const materiEmpty = !String(t?.materi ?? "").trim();
      const pertemuanValue = t?.pertemuan;
      const pertemuanInvalid =
        pertemuanValue !== undefined && pertemuanValue !== null && Number(pertemuanValue) <= 0;
      const tpRaw = Array.isArray(t?.tp) ? (t.tp as unknown[]) : [];
      const tpMissing =
        tpRaw.length === 0 ||
        !tpRaw.some((tp) => String((tp as { rumusan?: unknown })?.rumusan ?? "").trim());
      return materiEmpty || pertemuanInvalid || tpMissing;
    });
    if (invalidRaw) {
      throw new AiError(
        "AI_VALIDATION_ERROR",
        "Hasil analisis AI tidak lengkap (ada topik dengan materi/pertemuan/tujuan pembelajaran kosong). Coba analisis ulang.",
      );
    }

    const structFor = (raw: unknown) => {
      const t = raw as {
        no?: unknown;
        materi?: unknown;
        kompetensi?: unknown;
        pertemuan?: unknown;
        tp?: unknown;
      };
      return {
        no: Number(t?.no) || 0,
        materi: S(t?.materi),
        kompetensi: S(t?.kompetensi),
        pertemuan: Math.max(1, parseInt(S(t?.pertemuan, "1"), 10) || 1),
        tp: A<{
          kode?: unknown;
          rumusan?: unknown;
          indikator?: unknown;
          kktp?: unknown;
          level?: unknown;
        }>(t?.tp).map((x) => ({
          kode: S(x?.kode),
          rumusan: S(x?.rumusan),
          indikator: S(x?.indikator),
          kktp: S(x?.kktp),
          level: S(x?.level, "C3"),
        })),
      };
    };
    const stageAStructs = rawStageATopics.map(structFor);
    const ctx = topicsContext(stageAStructs);

    // Stage B (materi & pedagogi) dan Stage C (asesmen & modul) generate secara
    // independen dari struktur Stage A yang sama — kalau salah satu gagal usai
    // retry, Stage A tidak hilang/tidak perlu dianalisis ulang (tetap ter-cache).
    const stageBPromise = runStage("materi-pedagogi", {
      system: SYSTEM_PROMPT,
      cacheKey: `${baseCacheKey}:materi-pedagogi`,
      prompt: `Berikut topik & TP yang SUDAH ditentukan (jangan diubah, jangan dianalisis ulang). Lengkapi bagian materi & pedagogi untuk tiap topik.

Data:
${dataHeader(data)}

Topik & TP (urutan dan jumlah harus sama persis di jawaban Anda):
${ctx}

Keluarkan JSON PERSIS dengan bentuk (array "topics" urut sesuai nomor di atas, TANPA field no/materi/kompetensi/pertemuan/tp):
{"topics":[{
  "pemahamanBermakna":"...","pertanyaanPemantik":["...","..."],
  "model":"Problem Based Learning","alasanModel":"...","sintaks":["Sintaks 1","..."],"metode":"Diskusi, penugasan, presentasi",
  "lintasDisiplin":"...","dimensiProfil":[{"dimensi":"Bernalar Kritis","penerapan":"..."}],
  "materiFaktual":"...","materiKonseptual":"...","materiProsedural":"...","materiMetakognitif":"...",
  "pengetahuanAwal":"...","minatBelajar":"...","kebutuhanBelajar":"...",
  "kemitraan":"...","lingkungan":"...","digital":"...",
  "petaKonsep":["Konsep utama > sub konsep","..."],
  "uraianMateri":[{"judul":"Sub-bab","isi":"2-4 kalimat penjelasan mendalam disertai contoh"}],
  "rangkuman":"...",
  "pertemuanRinci":[{"pertemuan":1,"awal":["Pembukaan & doa (mindful) ...","Apersepsi ...","Penyampaian tujuan ..."],"memahami":[{"guru":"...","siswa":"...","media":"...","alokasi":"15 menit"}],"mengaplikasi":[{"guru":"...","siswa":"...","media":"...","alokasi":"25 menit"}],"merefleksi":[{"guru":"...","siswa":"...","media":"...","alokasi":"10 menit"}],"penutup":["Penguatan ...","Umpan balik ...","Informasi pertemuan berikutnya ..."]}],
  "lkpd":{"alatBahan":["..."],"langkah":["..."],"pertanyaan":["...","...","...","...","..."]}
}]}

${STAGE_B_QUALITY}
Hanya JSON.`,
    });

    const stageCPromise = runStage("asesmen-modul", {
      system: SYSTEM_PROMPT,
      cacheKey: `${baseCacheKey}:asesmen-modul`,
      prompt: `Berikut topik & TP yang SUDAH ditentukan (jangan diubah, jangan dianalisis ulang). Lengkapi bagian asesmen & modul untuk tiap topik.

Data:
${dataHeader(data)}

Topik & TP (urutan dan jumlah harus sama persis di jawaban Anda):
${ctx}

Keluarkan JSON PERSIS dengan bentuk (array "topics" urut sesuai nomor di atas, TANPA field no/materi/kompetensi/pertemuan/tp):
{"topics":[{
  "asesmen":{"diagnostik":[{"soal":"...","kunci":"..."}],"formatif":[{"aspek":"...","indikator":"...","teknik":"Observasi","instrumen":"Lembar observasi"}],"sumatif":[{"soal":"...","kunci":"...","skor":10}]},
  "kisi":[{"kodeTp":"TP.1.1","indikator":"...","materi":"...","level":"C3","bentuk":"Pilihan Ganda","nomor":"1","bobot":"1"}],
  "soal":{"pg":[{"no":1,"soal":"...","opsi":["A. ...","B. ...","C. ...","D. ...","E. ..."],"kunci":"B"}],"uraian":[{"no":1,"soal":"...","kunci":"...","skor":10}]},
  "rubrik":[{"jenis":"Pengetahuan","aspek":"...","sangatBaik":"...","baik":"...","cukup":"...","perluBimbingan":"..."}],
  "remedial":"...","pengayaan":"...",
  "refleksiGuru":["..."],"refleksiSiswa":["..."],
  "glosarium":[{"istilah":"...","arti":"..."}],"daftarPustaka":["..."]
}]}

${STAGE_C_QUALITY}
Hanya JSON.`,
    });

    const [stageB, stageC] = await Promise.all([stageBPromise, stageCPromise]);
    const rawStageBTopics = rawTopicsArray(stageB.raw);
    const rawStageCTopics = rawTopicsArray(stageC.raw);

    // Gabungkan per indeks (bukan bergantung pada AI mengembalikan "no" yang
    // konsisten) — Stage A tetap jadi sumber kebenaran untuk struktur.
    const topics = stageAStructs.map((struct, i) => {
      const merged = {
        ...struct,
        ...(rawStageBTopics[i] ?? {}),
        ...(rawStageCTopics[i] ?? {}),
        // Field struktur Stage A tidak boleh tertimpa meski Stage B/C ikut mengirimnya.
        no: struct.no || i + 1,
        materi: struct.materi,
        kompetensi: struct.kompetensi,
        pertemuan: struct.pertemuan,
        tp: struct.tp,
      };
      return normalizeTopic(merged, i, data.alokasiPerPertemuan);
    });

    console.log(
      `[analyzeCP] total ${Date.now() - totalStart}ms (struktur ${stageA.ms}ms, materi-pedagogi ${stageB.ms}ms, asesmen-modul ${stageC.ms}ms)`,
    );

    const master: MasterData = {
      jenjang: data.jenjang,
      kelas: data.kelas,
      fase: data.fase,
      mapel: data.mapel,
      semester: data.semester,
      cp: data.cp,
      alokasiPerPertemuan: data.alokasiPerPertemuan,
      topics,
    };

    return {
      topics: topics.map(({ no, materi, kompetensi, pertemuan, alokasi }) => ({
        no,
        materi,
        kompetensi,
        pertemuan,
        alokasi,
      })) as CpTopic[],
      master,
    };
  });
