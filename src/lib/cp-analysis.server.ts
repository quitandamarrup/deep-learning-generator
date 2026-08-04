import { askAI } from "./ai/ai.service";
import { AiError, classifyAskAIError } from "./ai/ai-errors";
import { buildCacheKey } from "./ai/cache";
import type { CpAnalysisInputType, MasterData, MasterTopic } from "./cp-analysis.functions";
import { cpFingerprint } from "./curriculum-fingerprint";

type RawTp = { kode?: unknown; rumusan?: unknown; indikator?: unknown; kktp?: unknown; level?: unknown };
type RawTopic = {
  materi?: unknown; kompetensi?: unknown; fokusBelajar?: unknown; tingkatKesulitan?: unknown;
  pertemuan?: unknown; alokasi?: unknown; tp?: unknown; atpDasar?: unknown;
  materiInti?: unknown; model?: unknown; asesmen?: unknown;
};

const GENERIC_TITLES = new Set(["pengantar", "pendahuluan", "materi", "materi 1", "materi 2", "dasar dasar", "konsep dasar", "topik 1", "topik 2", "pembelajaran"]);
const OPERATIONAL_VERBS = ["menganalisis", "mengidentifikasi", "membandingkan", "menjelaskan", "menentukan", "menyimpulkan", "mengevaluasi", "merancang", "membuat", "menyusun", "menerapkan", "mendemonstrasikan", "mempraktikkan", "mengomunikasikan", "mempresentasikan", "menafsirkan", "mengklasifikasikan", "memecahkan"];
const STOP_WORDS = new Set(["yang", "dan", "atau", "dalam", "dengan", "untuk", "dari", "pada", "secara", "tentang", "peserta", "didik", "mampu", "dapat", "melalui", "berbagai", "serta", "suatu", "the", "and", "with", "from", "about", "their"]);

const text = (value: unknown, fallback = "") => value === undefined || value === null ? fallback : String(value).trim();
const array = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

function extractJson(value: string): string {
  const fence = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start >= 0 && end > start ? value.slice(start, end + 1) : value.trim();
}

function normalized(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function significantWords(value: string): Set<string> {
  return new Set(normalized(value).split(" ").filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function normalizeTopic(raw: RawTopic, index: number, allocation: string): MasterTopic | undefined {
  const materi = text(raw.materi);
  const kompetensi = text(raw.kompetensi);
  const fokusBelajar = text(raw.fokusBelajar);
  if (!materi || !kompetensi || !fokusBelajar || GENERIC_TITLES.has(normalized(materi))) return undefined;

  const no = index + 1;
  const seenTp = new Set<string>();
  const tp = array<RawTp>(raw.tp).map((item, tpIndex) => {
    const rumusan = text(item.rumusan);
    const indikator = text(item.indikator);
    const kktp = text(item.kktp);
    const key = normalized(rumusan);
    if (!rumusan || !indikator || !kktp || !OPERATIONAL_VERBS.some((verb) => rumusan.toLowerCase().includes(verb)) || seenTp.has(key)) return undefined;
    seenTp.add(key);
    return { kode: text(item.kode, `TP.${no}.${tpIndex + 1}`), rumusan, indikator, kktp, level: text(item.level, "C3") };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!tp.length) return undefined;

  const requestedOrder = array<{ kodeTp?: unknown }>(raw.atpDasar).map((item) => text(item.kodeTp));
  const orderedTp = requestedOrder.length ? [...tp].sort((a, b) => {
    const ai = requestedOrder.indexOf(a.kode);
    const bi = requestedOrder.indexOf(b.kode);
    return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
  }) : tp;
  const meetings = Math.max(1, Math.round(Number(raw.pertemuan) || 1));
  const materials = (raw.materiInti ?? {}) as Record<string, unknown>;
  const model = (raw.model ?? {}) as Record<string, unknown>;
  const assessments = array<Record<string, unknown>>(raw.asesmen);

  return {
    no, materi, kompetensi, fokusBelajar, pertemuan: meetings,
    alokasi: text(raw.alokasi, `${meetings} x (${allocation})`),
    tingkatKesulitan: text(raw.tingkatKesulitan, "Menengah"), tp: orderedTp,
    pemahamanBermakna: fokusBelajar, pertanyaanPemantik: [],
    model: text(model.nama, "Inquiry Learning"), alasanModel: text(model.alasan),
    sintaks: [], metode: text(model.metode), lintasDisiplin: "", dimensiProfil: [],
    materiFaktual: text(materials.faktual), materiKonseptual: text(materials.konseptual),
    materiProsedural: text(materials.prosedural), materiMetakognitif: text(materials.metakognitif),
    pengetahuanAwal: "", minatBelajar: "", kebutuhanBelajar: "", kemitraan: "", lingkungan: "", digital: "",
    uraianMateri: [], petaKonsep: [], rangkuman: fokusBelajar, pertemuanRinci: [],
    lkpd: { alatBahan: [], langkah: [], pertanyaan: [] },
    asesmen: { diagnostik: [], formatif: assessments.map((row) => ({ aspek: text(row.dimensi), indikator: text(row.bukti), teknik: text(row.teknik), instrumen: text(row.instrumen) })), sumatif: [] },
    kisi: [], soal: { pg: [], uraian: [] }, rubrik: [], remedial: "", pengayaan: "",
    refleksiGuru: [], refleksiSiswa: [], glosarium: [], daftarPustaka: [],
  };
}

function parseAndValidate(rawText: string, data: CpAnalysisInputType): MasterData {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(rawText)) as Record<string, unknown>;
  } catch (cause) {
    throw new AiError("AI_INVALID_JSON", "Gagal memproses hasil analisis AI (format JSON tidak valid).", { cause });
  }

  const cpWords = significantWords(data.cp);
  const seen = new Set<string>();
  const topics = array<RawTopic>(parsed.topics)
    .filter((topic) => [...significantWords(`${text(topic.materi)} ${text(topic.kompetensi)} ${text(topic.fokusBelajar)}`)].some((word) => cpWords.has(word)))
    .filter((topic) => {
      const key = normalized(text(topic.materi));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((topic, index) => normalizeTopic(topic, index, data.alokasiPerPertemuan))
    .filter((topic): topic is MasterTopic => Boolean(topic));

  if (!topics.length) throw new AiError("AI_VALIDATION_ERROR", "Hasil analisis AI belum dapat ditelusuri ke CP atau belum memiliki TP yang valid. Coba analisis ulang.");

  const strings = (value: unknown) => Array.from(new Set(array<unknown>(value).map((item) => text(item)).filter(Boolean)));
  return { ...data, mainCompetencies: strings(parsed.mainCompetencies), supportingCompetencies: strings(parsed.supportingCompetencies), topics };
}

export async function executeCpAnalysis(data: CpAnalysisInputType) {
  const system = `Anda adalah mesin analisis kurikulum Indonesia. Baca CP secara utuh sebelum menghasilkan data.

Lakukan secara INTERNAL dan jangan tampilkan penalarannya:
1. Identifikasi domain, mata pelajaran, fase, kelas, kompetensi utama/pendukung, dimensi pengetahuan/keterampilan, konteks, hasil belajar, level Bloom, dan prasyarat.
2. Ukur kompleksitas dari jumlah kompetensi, kedalaman berpikir, praktik, komunikasi, proyek, dan asesmen. Jangan gunakan aturan alokasi tetap.
3. Turunkan hanya data kurikulum inti yang dapat ditelusuri ke CP.

ATURAN MUTLAK:
- Topik wajib berasal langsung dari CP; dilarang judul generik.
- TP wajib berasal dari topik, terukur, teramati, memakai kata kerja operasional, serta memuat konten, konteks, indikator, dan kriteria keberhasilan. Jangan menyalin CP.
- ATP hanya dari TP dan diurutkan berdasarkan prasyarat dari sederhana ke kompleks.
- Materi hanya yang diperlukan TP, dipisahkan faktual, konseptual, prosedural, dan metakognitif.
- Model dipilih berdasarkan kompetensi; jangan selalu Project Based Learning.
- Asesmen wajib menyebut TP yang diukur dan selaras: pengetahuan=tulis/lisan, keterampilan=kinerja/proyek/produk, sikap=observasi/refleksi.
- Jangan membuat modul ajar, RPP, kegiatan pertemuan, LKPD, rubrik, kisi-kisi, atau bank soal.
- Hindari duplikasi dan penjelasan naratif. Keluarkan hanya JSON valid.

Verifikasi internal sebelum menjawab: topik←CP; TP←topik; ATP←TP; materi→TP; alokasi realistis; asesmen→TP; tanpa kurikulum generik.`;

  const prompt = `Analisis CP berikut.
Jenjang: ${data.jenjang}\nKelas: ${data.kelas}\nFase: ${data.fase}\nMata Pelajaran: ${data.mapel}\nSemester: ${data.semester}\nAlokasi per pertemuan: ${data.alokasiPerPertemuan}\nCP:\n${data.cp}

Keluarkan tepat dalam bentuk ini:
{"mainCompetencies":["kompetensi utama spesifik dari CP"],"supportingCompetencies":["kompetensi pendukung spesifik dari CP"],"topics":[{"materi":"judul topik spesifik dari CP","kompetensi":"kompetensi CP yang dituju","fokusBelajar":"fokus terukur topik","tingkatKesulitan":"Dasar | Menengah | Lanjut","pertemuan":2,"alokasi":"2 x (${data.alokasiPerPertemuan})","tp":[{"kode":"TP.1.1","rumusan":"kata kerja operasional + konten + konteks","indikator":"bukti teramati","kktp":"kriteria keberhasilan spesifik","level":"C3"}],"atpDasar":[{"urutan":1,"kodeTp":"TP.1.1","alasanUrutan":"prasyarat/progresi singkat"}],"materiInti":{"faktual":"...","konseptual":"...","prosedural":"...","metakognitif":"..."},"model":{"nama":"Inquiry Learning","alasan":"kaitan dengan kompetensi","metode":"metode relevan"},"asesmen":[{"tpCodes":["TP.1.1"],"dimensi":"Pengetahuan | Keterampilan | Sikap","teknik":"...","instrumen":"...","bukti":"bukti pencapaian TP"}]}]}`;

  const cacheKey = buildCacheKey("cp-analysis-v3-core", { jenjang: data.jenjang, kelas: data.kelas, fase: data.fase, mapel: data.mapel.trim(), semester: data.semester, alokasiPerPertemuan: data.alokasiPerPertemuan, cp: cpFingerprint(data.cp) });
  let output: string;
  try {
    ({ text: output } = await askAI({ system, prompt, cacheKey, cacheTtlMs: 60 * 60 * 1000, retry: { attempts: 3, baseDelayMs: 700, onRetry: (_error, attempt, delayMs) => console.warn(`[analyzeCP] retry ${attempt} in ${Math.round(delayMs)}ms`) } }));
  } catch (error) {
    throw classifyAskAIError(error);
  }

  const master = parseAndValidate(output, data);
  return { topics: master.topics.map(({ no, materi, kompetensi, pertemuan, alokasi }) => ({ no, materi, kompetensi, pertemuan, alokasi })), master };
}