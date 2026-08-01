import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { DocContextType } from "./admin-docs.functions";
import type { MasterData, MasterTopic } from "./cp-analysis.functions";

/**
 * TEMPLATE ENGINE MODUL AJAR
 *
 * Mengisi Template Master DOCX (public/templates/modul-ajar-2025.docx) dengan
 * Master Data hasil satu kali Analisis CP. Tidak membuat dokumen Word baru:
 * template disalin, placeholder diisi, lalu disimpan sebagai DOCX baru sehingga
 * header/footer/margin/font/tabel/border/penomoran/layout tetap identik.
 */

export const MODUL_AJAR_TEMPLATE_URL = "/templates/modul-ajar-2025.docx";

const XML_ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape + pertahankan baris baru sebagai <w:br/> di dalam run yang sama. */
function xmlText(value: string): string {
  const esc = (value ?? "").replace(/[&<>"']/g, (c) => XML_ESC[c]);
  return esc.replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
}

type Values = Record<string, string>;

function applyValues(xml: string, values: Values): string {
  let out = xml;
  for (const [key, val] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(xmlText(val));
  }
  // token yang tidak terpakai dibiarkan kosong (bagian kosong tetap kosong)
  return out.replace(/\{\{[A-Z0-9_]+\}\}/g, "");
}

/** Ambil rentang XML satu blok pertemuan (dari <w:p> pembuka sampai <w:p> penutup). */
function sliceBlock(xml: string, openToken: string, closeToken: string) {
  const openAt = xml.indexOf(openToken);
  const closeAt = xml.indexOf(closeToken);
  if (openAt === -1 || closeAt === -1) return null;
  const start = xml.lastIndexOf("<w:p", openAt);
  const endTag = xml.indexOf("</w:p>", closeAt);
  if (start === -1 || endTag === -1) return null;
  const end = endTag + "</w:p>".length;
  return { start, end, block: xml.slice(start, end) };
}

/* ------------------------- pemetaan Master Data ------------------------- */

const j = (arr: (string | undefined)[] | undefined, sep = "; ") =>
  (arr ?? []).map((x) => (x ?? "").trim()).filter(Boolean).join(sep);

function topicOf(master: MasterData, ctx: DocContextType): MasterTopic {
  const no = ctx.selectedTopicNo;
  return (no ? master.topics.find((t) => t.no === no) : undefined) ?? master.topics[0];
}

export function buildModulAjarValues(master: MasterData, ctx: DocContextType) {
  const t = topicOf(master, ctx);
  const faseKelas = `${ctx.fase} / ${ctx.kelas}`;
  const alokasi = t?.alokasi || `${t?.pertemuan ?? 1} x (${ctx.alokasiPerPertemuan})`;
  const tp = t?.tp ?? [];
  const rubrik = t?.rubrik ?? [];
  const lkpd = t?.lkpd;

  const values: Values = {
    MAPEL: ctx.mapel,
    FASE_KELAS: faseKelas,
    TOPIK: t?.materi ?? "",
    ALOKASI: alokasi,
    PENYUSUN: `${ctx.penyusun}${ctx.satuan ? ` — ${ctx.satuan}` : ""}`,
    JUDUL_MODUL: t?.materi ?? "",
    PROFIL_LULUSAN: j((t?.dimensiProfil ?? []).map((d) => d.dimensi)),
    KARAKTERISTIK: j([t?.pengetahuanAwal, t?.minatBelajar, t?.kebutuhanBelajar]),
    // CP ditempel apa adanya sesuai input guru
    CP_ELEMEN: t?.kompetensi ?? "",
    CP: ctx.cp,
    MATERI_INTI: j([t?.materiFaktual, t?.materiKonseptual, t?.materiProsedural, t?.materiMetakognitif], " "),
    PRAKTIK_PEDAGOGIS: [t?.model, t?.metode].filter(Boolean).join(" — "),
    LINGKUNGAN: j([t?.lingkungan, t?.digital, t?.kemitraan]),
    DIFERENSIASI: j([t?.kebutuhanBelajar, t?.minatBelajar]),
    DIAG_TEKNIK: j((t?.asesmen?.diagnostik ?? []).map((d) => d.soal)),
    DIAG_TINDAK: t?.remedial ?? "",
    FORM_TEKNIK: j((t?.asesmen?.formatif ?? []).map((f) => `${f.teknik}: ${f.instrumen}`)),
    FORM_TINDAK: [t?.remedial, t?.pengayaan].filter(Boolean).join(" / "),
    SUM_TEKNIK: j((t?.asesmen?.sumatif ?? []).map((s) => s.soal)),
    SUM_TINDAK: t?.pengayaan ?? "",
    RINGKASAN_TP: tp.map((x, i) => `${i + 1}. ${x.rumusan}`).join("\n"),
    RINGKASAN_ALUR: (t?.pertemuanRinci ?? [])
      .map(
        (p) =>
          `Pertemuan ${p.pertemuan}: Memahami ${p.memahami[0]?.siswa ?? "-"} → Mengaplikasi ${
            p.mengaplikasi[0]?.siswa ?? "-"
          } → Merefleksi ${p.merefleksi[0]?.siswa ?? "-"}`,
      )
      .join("\n"),
    RINGKASAN_ASESMEN: j((t?.asesmen?.sumatif ?? []).map((s) => s.soal)),
    LAMP1_KET: t?.pertemuan ? "Digunakan pada tahap Mengaplikasi pertemuan 1." : "",
    LAMP2_KET: (t?.pertemuan ?? 0) >= 2 ? "Digunakan pada tahap Mengaplikasi pertemuan 2." : "",
    LAMP3_KET: (t?.pertemuan ?? 0) >= 3 ? "Digunakan pada tahap Mengaplikasi pertemuan 3." : "",
    LAMP5_KET: j([...(t?.pertemuanRinci?.[0]?.memahami ?? []).map((a) => a.media), ...(t?.daftarPustaka ?? [])]),
    LAMP6_KET: j(t?.refleksiSiswa),
    LKPD_PERTEMUAN: "1",
    LKPD_TAHAP: "Mengaplikasi",
    LKPD_TUJUAN: tp[0]?.rumusan ?? "",
    LKPD_STIMULUS: j(lkpd?.alatBahan) || t?.pemahamanBermakna || "",
    LKPD_TUGAS_1: lkpd?.pertanyaan?.[0] ?? "",
    LKPD_TUGAS_2: lkpd?.pertanyaan?.[1] ?? "",
    LKPD_TUGAS_3: lkpd?.pertanyaan?.[2] ?? "",
  };

  // TP-1..TP-3 (slot tetap; kosong dibiarkan kosong)
  for (let i = 0; i < 3; i++) {
    const x = tp[i];
    values[`TP${i + 1}_RUMUSAN`] = x?.rumusan ?? "";
    values[`TP${i + 1}_INDIKATOR`] = x?.indikator ?? "";
    values[`TP${i + 1}_BUKTI`] = x?.kktp ?? "";
  }

  // Rubrik 4 slot pada 3.2
  for (let i = 0; i < 4; i++) {
    const r = rubrik[i];
    values[`RUB${i + 1}_IND`] = r?.aspek ?? "";
    values[`RUB${i + 1}_MB`] = r?.perluBimbingan ?? "";
    values[`RUB${i + 1}_BSH`] = r?.baik ?? "";
    values[`RUB${i + 1}_SB`] = r?.sangatBaik ?? "";
    values[`RUB${i + 1}_CATATAN`] = r?.cukup ?? "";
  }

  // Rubrik Penilaian Saja (3 slot)
  for (let i = 0; i < 3; i++) {
    const r = rubrik[i];
    values[`RS${i + 1}_TP`] = tp[Math.min(i, Math.max(tp.length - 1, 0))]?.kode
      ? `${tp[Math.min(i, tp.length - 1)].kode}: ${tp[Math.min(i, tp.length - 1)].rumusan}`
      : "";
    values[`RS${i + 1}_IND`] = r?.aspek ?? "";
    values[`RS${i + 1}_MB`] = r?.perluBimbingan ?? "";
    values[`RS${i + 1}_BSH`] = r?.baik ?? "";
    values[`RS${i + 1}_SB`] = r?.sangatBaik ?? "";
  }

  // Blok pertemuan otomatis sesuai jumlah pertemuan hasil Analisis CP
  const count = Math.max(1, t?.pertemuan ?? (t?.pertemuanRinci?.length || 1));
  const meetings: Values[] = [];
  for (let i = 0; i < count; i++) {
    const p = t?.pertemuanRinci?.[i];
    meetings.push({
      P_NO: String(i + 1),
      P_SUBTOPIK: t?.uraianMateri?.[i]?.judul ?? t?.materi ?? "",
      P_PEMANTIK: t?.pertanyaanPemantik?.[i] ?? t?.pertanyaanPemantik?.[0] ?? "",
      P_PENDAHULUAN_1: p?.awal?.[0] ?? "",
      P_PENDAHULUAN_2: j(p?.awal?.slice(1)),
      P_MEMAHAMI_AKT: j((p?.memahami ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MEMAHAMI_PRODUK: j((p?.memahami ?? []).map((a) => a.media)),
      P_MEMAHAMI_ASESMEN: t?.asesmen?.formatif?.[0]?.teknik ?? "",
      P_MENGAPLIKASI_AKT: j((p?.mengaplikasi ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MENGAPLIKASI_PRODUK: j((p?.mengaplikasi ?? []).map((a) => a.media)),
      P_MENGAPLIKASI_ASESMEN: t?.asesmen?.formatif?.[1]?.teknik ?? "",
      P_MEREFLEKSI_AKT: j((p?.merefleksi ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MEREFLEKSI_PRODUK: j((p?.merefleksi ?? []).map((a) => a.media)),
      P_MEREFLEKSI_ASESMEN: t?.asesmen?.formatif?.[2]?.teknik ?? "",
      P_PENUTUP_1: p?.penutup?.[0] ?? "",
      P_PENUTUP_2: j(p?.penutup?.slice(1)),
    });
  }

  return { values, meetings };
}

/* ------------------------- pengisian template ------------------------- */

export async function buildModulAjarDocxBlob(master: MasterData, ctx: DocContextType): Promise<Blob> {
  const res = await fetch(MODUL_AJAR_TEMPLATE_URL);
  if (!res.ok) throw new Error("Template Master Modul Ajar tidak ditemukan.");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Template Master tidak valid.");
  let xml = await docFile.async("string");

  const { values, meetings } = buildModulAjarValues(master, ctx);

  const block = sliceBlock(xml, "{{#PERTEMUAN}}", "{{/PERTEMUAN}}");
  if (block) {
    const rendered = meetings
      .map((m) => applyValues(block.block.replace("{{#PERTEMUAN}}", "").replace("{{/PERTEMUAN}}", ""), m))
      .join("");
    xml = xml.slice(0, block.start) + rendered + xml.slice(block.end);
  }

  xml = applyValues(xml, values);
  zip.file("word/document.xml", xml);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadModulAjarDocx(filename: string, master: MasterData, ctx: DocContextType) {
  const blob = await buildModulAjarDocxBlob(master, ctx);
  saveAs(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
}
