import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

export const analyzeCP = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CpAnalysisInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `Anda adalah ahli kurikulum Indonesia. Tugas Anda menganalisis Capaian Pembelajaran (CP) dan membaginya menjadi beberapa materi/topik pembelajaran yang logis dan terurut.
Pertimbangkan: (1) keluasan materi, (2) kompleksitas kompetensi, (3) tingkat kelas/fase, (4) alokasi waktu, (5) urutan pembelajaran yang logis, (6) ketercapaian CP.
Jumlah pertemuan HARUS proporsional dengan keluasan & kompleksitas materi — bukan angka acak.
Keluarkan HANYA JSON array valid, tanpa penjelasan, tanpa markdown fence.`;

    const prompt = `Analisis CP berikut dan bagi menjadi 3–8 materi/topik pembelajaran yang logis.

Data:
- Jenjang: ${data.jenjang}
- Kelas: ${data.kelas}
- Fase: ${data.fase}
- Mata Pelajaran: ${data.mapel}
- Semester: ${data.semester}
- Alokasi JP per pertemuan: ${data.alokasiPerPertemuan}
- Capaian Pembelajaran:
${data.cp}

Keluarkan JSON array dengan format PERSIS:
[
  {
    "no": 1,
    "materi": "Judul materi/topik singkat",
    "kompetensi": "Kompetensi/Tujuan utama yang ingin dicapai pada topik ini",
    "pertemuan": 2,
    "alokasi": "2 x (${data.alokasiPerPertemuan})"
  }
]

Ketentuan:
- "pertemuan" adalah integer >= 1 sesuai kompleksitas.
- "alokasi" = jumlah pertemuan dikali alokasi per pertemuan, format string seperti contoh.
- Urutkan dari materi paling dasar ke lanjutan.
- Hanya JSON, tanpa teks lain.`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text));
    } catch {
      throw new Error("Gagal memproses hasil analisis AI.");
    }
    if (!Array.isArray(parsed)) throw new Error("Format hasil tidak valid.");

    const topics: CpTopic[] = parsed.map((t: any, i: number) => ({
      no: i + 1,
      materi: String(t.materi ?? ""),
      kompetensi: String(t.kompetensi ?? ""),
      pertemuan: Math.max(1, parseInt(String(t.pertemuan ?? "1"), 10) || 1),
      alokasi: String(t.alokasi ?? `${Math.max(1, parseInt(String(t.pertemuan ?? "1"), 10) || 1)} x (${data.alokasiPerPertemuan})`),
    }));

    return { topics };
  });
