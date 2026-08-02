import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { DocContextType } from "./admin-docs.functions";
import type { MasterData } from "./cp-analysis.functions";
import {
  buildMasterKurikulum,
  unitOf,
  type MasterKurikulum,
} from "./master-kurikulum";


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
  const start = Math.max(xml.lastIndexOf("<w:p>", openAt), xml.lastIndexOf("<w:p ", openAt));
  const endTag = xml.indexOf("</w:p>", closeAt);
  if (start === -1 || endTag === -1) return null;
  const end = endTag + "</w:p>".length;
  return { start, end, block: xml.slice(start, end) };
}

/* ------------------- pemetaan dari MASTER_KURIKULUM ------------------- */

const j = (arr: (string | undefined)[] | undefined, sep = "; ") =>
  (arr ?? []).map((x) => (x ?? "").trim()).filter(Boolean).join(sep);

/** Seluruh nilai template diambil dari MASTER_KURIKULUM — tanpa memanggil AI. */
export function buildModulAjarValuesFromMK(mk: MasterKurikulum, topicNo?: number) {
  const id = mk.identitas;
  const u = unitOf(mk, topicNo);
  const tp = u?.tujuanPembelajaran ?? [];
  const rubrik = u?.rubrik ?? [];
  const lkpd = u?.lkpd;

  const values: Values = {
    NAMA_SEKOLAH: id.namaSekolah,
    GURU: id.guru,
    MAPEL: id.mapel,
    FASE_KELAS: `${id.fase} / ${id.kelas}`,
    SEMESTER: id.semester,
    TAHUN_AJARAN: id.tahunAjaran,
    TOPIK: u?.topik ?? "",
    ALOKASI: u?.alokasiWaktu ?? "",
    PENYUSUN: `${id.guru}${id.namaSekolah ? ` — ${id.namaSekolah}` : ""}`,
    JUDUL_MODUL: u?.topik ?? "",
    PROFIL_LULUSAN: j((u?.profilLulusan ?? []).map((d) => d.dimensi)),
    KARAKTERISTIK: j([
      u?.karakteristikMurid.pengetahuanAwal,
      u?.karakteristikMurid.minatBelajar,
      u?.karakteristikMurid.kebutuhanBelajar,
    ]),
    // CP ditempel apa adanya sesuai input guru
    CP_ELEMEN: u?.elemen ?? "",
    CP: mk.cp,
    MATERI_INTI: j(
      [
        u?.materiInti.faktual,
        u?.materiInti.konseptual,
        u?.materiInti.prosedural,
        u?.materiInti.metakognitif,
      ],
      " ",
    ),
    PRAKTIK_PEDAGOGIS: [u?.praktikPedagogis.modelPembelajaran, u?.praktikPedagogis.metode]
      .filter(Boolean)
      .join(" — "),
    LINGKUNGAN: u?.lingkunganPembelajaran ?? "",
    MEDIA: j(u?.media),
    SUMBER_BELAJAR: j(u?.sumberBelajar),
    DIFERENSIASI: u?.diferensiasi ?? "",
    DIAG_TEKNIK: j((u?.asesmenAwal ?? []).map((d) => d.soal)),
    DIAG_TINDAK: u?.tindakLanjut.remedial ?? "",
    FORM_TEKNIK: j((u?.asesmenFormatif ?? []).map((f) => `${f.teknik}: ${f.instrumen}`)),
    FORM_TINDAK: [u?.tindakLanjut.remedial, u?.tindakLanjut.pengayaan].filter(Boolean).join(" / "),
    SUM_TEKNIK: j((u?.asesmenSumatif ?? []).map((s) => s.soal)),
    SUM_TINDAK: u?.tindakLanjut.pengayaan ?? "",
    RINGKASAN_TP: u?.ringkasanModul.tp ?? "",
    RINGKASAN_ALUR: u?.ringkasanModul.alur ?? "",
    RINGKASAN_ASESMEN: u?.ringkasanModul.asesmen ?? "",
    LAMP1_KET: u?.jumlahPertemuan ? "Digunakan pada tahap Mengaplikasi pertemuan 1." : "",
    LAMP2_KET: (u?.jumlahPertemuan ?? 0) >= 2 ? "Digunakan pada tahap Mengaplikasi pertemuan 2." : "",
    LAMP3_KET: (u?.jumlahPertemuan ?? 0) >= 3 ? "Digunakan pada tahap Mengaplikasi pertemuan 3." : "",
    LAMP5_KET: j([...(u?.media ?? []), ...(u?.sumberBelajar ?? [])]),
    LAMP6_KET: j(u?.refleksi.siswa),
    LKPD_PERTEMUAN: "1",
    LKPD_TAHAP: "Mengaplikasi",
    LKPD_TUJUAN: tp[0]?.rumusan ?? "",
    LKPD_STIMULUS: j(lkpd?.alatBahan) || u?.ringkasanModul.pemahamanBermakna || "",
    LKPD_TUGAS_1: lkpd?.pertanyaan?.[0] ?? "",
    LKPD_TUGAS_2: lkpd?.pertanyaan?.[1] ?? "",
    LKPD_TUGAS_3: lkpd?.pertanyaan?.[2] ?? "",
  };

  // TP-1..TP-3 (slot tetap; kosong dibiarkan kosong)
  for (let i = 0; i < 3; i++) {
    const x = tp[i];
    values[`TP${i + 1}_RUMUSAN`] = x?.rumusan ?? "";
    values[`TP${i + 1}_INDIKATOR`] = x?.indikator ?? "";
    values[`TP${i + 1}_BUKTI`] = x?.buktiBelajar ?? "";
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
    const t = tp.length ? tp[Math.min(i, tp.length - 1)] : undefined;
    values[`RS${i + 1}_TP`] = t ? `${t.kode}: ${t.rumusan}` : "";
    values[`RS${i + 1}_IND`] = r?.aspek ?? "";
    values[`RS${i + 1}_MB`] = r?.perluBimbingan ?? "";
    values[`RS${i + 1}_BSH`] = r?.baik ?? "";
    values[`RS${i + 1}_SB`] = r?.sangatBaik ?? "";
  }

  // Blok pertemuan otomatis sesuai jumlah pertemuan hasil Analisis CP
  const count = Math.max(1, u?.jumlahPertemuan ?? (u?.pengalamanBelajar.length || 1));
  const meetings: Values[] = [];
  for (let i = 0; i < count; i++) {
    const p = u?.pengalamanBelajar?.[i];
    meetings.push({
      P_NO: String(i + 1),
      P_SUBTOPIK: u?.subTopik?.[i] ?? u?.topik ?? "",
      P_PEMANTIK: p?.pemantik ?? "",
      P_PENDAHULUAN_1: p?.awal?.[0] ?? "",
      P_PENDAHULUAN_2: j(p?.awal?.slice(1)),
      P_MEMAHAMI_AKT: j((p?.memahami ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MEMAHAMI_PRODUK: j((p?.memahami ?? []).map((a) => a.media)),
      P_MEMAHAMI_ASESMEN: u?.asesmenFormatif?.[0]?.teknik ?? "",
      P_MENGAPLIKASI_AKT: j((p?.mengaplikasi ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MENGAPLIKASI_PRODUK: j((p?.mengaplikasi ?? []).map((a) => a.media)),
      P_MENGAPLIKASI_ASESMEN: u?.asesmenFormatif?.[1]?.teknik ?? "",
      P_MEREFLEKSI_AKT: j((p?.merefleksi ?? []).map((a) => `Guru: ${a.guru} Murid: ${a.siswa}`), " "),
      P_MEREFLEKSI_PRODUK: j((p?.merefleksi ?? []).map((a) => a.media)),
      P_MEREFLEKSI_ASESMEN: u?.asesmenFormatif?.[2]?.teknik ?? "",
      P_PENUTUP_1: p?.penutup?.[0] ?? "",
      P_PENUTUP_2: j(p?.penutup?.slice(1)),
    });
  }

  return { values, meetings };
}

/** Kompatibilitas: Master Data + konteks form → MASTER_KURIKULUM → nilai template. */
export function buildModulAjarValues(master: MasterData, ctx: DocContextType) {
  return buildModulAjarValuesFromMK(buildMasterKurikulum(master, ctx), ctx.selectedTopicNo);
}


/* ------------------------- pengisian template ------------------------- */

/** Isi Template Master langsung dari MASTER_KURIKULUM (tanpa AI). */
export async function buildModulAjarDocxBlobFromMK(
  mk: MasterKurikulum,
  topicNo?: number,
): Promise<Blob> {
  const res = await fetch(MODUL_AJAR_TEMPLATE_URL);
  if (!res.ok) throw new Error("Template Master Modul Ajar tidak ditemukan.");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Template Master tidak valid.");
  let xml = await docFile.async("string");

  const { values, meetings } = buildModulAjarValuesFromMK(mk, topicNo);


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
