import type { DocContextType } from "./admin-docs.functions";
import type { MasterData, MasterTopic } from "./cp-analysis.functions";

/**
 * MASTER_KURIKULUM
 *
 * Sumber data utama seluruh administrasi pembelajaran. Dibentuk SATU KALI dari
 * hasil Analisis CP (satu panggilan AI), lalu disimpan di database
 * (tabel `master_kurikulum`) per User + Mapel + Semester + Tahun Ajaran.
 *
 * Semua dokumen (Modul Ajar, ATP, RPP, KKTP, PROTA, PROSEM, Jurnal, LKPD,
 * Bahan Ajar, Kisi-kisi, Soal, Rubrik) WAJIB membaca dari objek ini —
 * tanpa memanggil AI lagi.
 */

export type MkIdentitas = {
  namaSekolah: string;
  guru: string;
  mapel: string;
  jenjang: string;
  fase: string;
  kelas: string;
  semester: string;
  tahunAjaran: string;
};

export type MkAktivitas = { guru: string; siswa: string; media: string; alokasi: string };

export type MkUnit = {
  no: number;
  elemen: string;
  topik: string;
  subTopik: string[];
  materi: string;
  jumlahPertemuan: number;
  alokasiWaktu: string;

  profilLulusan: { dimensi: string; penerapan: string }[];
  karakteristikMurid: { pengetahuanAwal: string; minatBelajar: string; kebutuhanBelajar: string };

  tujuanPembelajaran: { kode: string; rumusan: string; indikator: string; buktiBelajar: string; level: string }[];
  atp: { urutan: number; kodeTp: string; kegiatan: string; pertemuan: number; alokasi: string }[];

  materiInti: {
    faktual: string;
    konseptual: string;
    prosedural: string;
    metakognitif: string;
    uraian: { judul: string; isi: string }[];
    petaKonsep: string[];
    rangkuman: string;
  };

  praktikPedagogis: {
    modelPembelajaran: string;
    alasanModel: string;
    pendekatan: string;
    metode: string;
    sintaks: string[];
    lintasDisiplin: string;
  };

  lingkunganPembelajaran: string;
  media: string[];
  sumberBelajar: string[];
  diferensiasi: string;

  asesmenAwal: { soal: string; kunci: string }[];
  asesmenFormatif: { aspek: string; indikator: string; teknik: string; instrumen: string }[];
  asesmenSumatif: { soal: string; kunci: string; skor: number }[];
  kktp: { kodeTp: string; kriteria: string }[];
  kisi: MasterTopic["kisi"];
  soal: MasterTopic["soal"];
  rubrik: MasterTopic["rubrik"];

  pengalamanBelajar: {
    pertemuan: number;
    pemantik: string;
    awal: string[];
    memahami: MkAktivitas[];
    mengaplikasi: MkAktivitas[];
    merefleksi: MkAktivitas[];
    penutup: string[];
  }[];

  lkpd: { alatBahan: string[]; langkah: string[]; pertanyaan: string[] };

  refleksi: { guru: string[]; siswa: string[] };
  tindakLanjut: { remedial: string; pengayaan: string };
  lampiran: { glosarium: { istilah: string; arti: string }[]; daftarPustaka: string[] };
  ringkasanModul: { tp: string; alur: string; asesmen: string; pemahamanBermakna: string };
};

export type MasterKurikulum = {
  version: 1;
  identitas: MkIdentitas;
  cp: string;
  alokasiPerPertemuan: string;
  units: MkUnit[];
};

const j = (arr: (string | undefined)[] | undefined, sep = "; ") =>
  (arr ?? []).map((x) => (x ?? "").trim()).filter(Boolean).join(sep);

const uniq = (arr: string[]) => Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));

function toUnit(t: MasterTopic, ctx: DocContextType): MkUnit {
  const media = uniq(
    (t.pertemuanRinci ?? []).flatMap((p) => [
      ...p.memahami.map((a) => a.media),
      ...p.mengaplikasi.map((a) => a.media),
      ...p.merefleksi.map((a) => a.media),
    ]),
  );
  return {
    no: t.no,
    elemen: t.kompetensi,
    topik: t.materi,
    subTopik: (t.uraianMateri ?? []).map((u) => u.judul).filter(Boolean),
    materi: t.materi,
    jumlahPertemuan: Math.max(1, t.pertemuan || (t.pertemuanRinci?.length ?? 1)),
    alokasiWaktu: t.alokasi || `${t.pertemuan} x (${ctx.alokasiPerPertemuan})`,

    profilLulusan: t.dimensiProfil ?? [],
    karakteristikMurid: {
      pengetahuanAwal: t.pengetahuanAwal,
      minatBelajar: t.minatBelajar,
      kebutuhanBelajar: t.kebutuhanBelajar,
    },

    tujuanPembelajaran: (t.tp ?? []).map((x) => ({
      kode: x.kode,
      rumusan: x.rumusan,
      indikator: x.indikator,
      buktiBelajar: x.kktp,
      level: x.level,
    })),
    atp: (t.tp ?? []).map((x, i) => ({
      urutan: i + 1,
      kodeTp: x.kode,
      kegiatan: x.rumusan,
      pertemuan: Math.min(i + 1, Math.max(1, t.pertemuan || 1)),
      alokasi: ctx.alokasiPerPertemuan,
    })),

    materiInti: {
      faktual: t.materiFaktual,
      konseptual: t.materiKonseptual,
      prosedural: t.materiProsedural,
      metakognitif: t.materiMetakognitif,
      uraian: t.uraianMateri ?? [],
      petaKonsep: t.petaKonsep ?? [],
      rangkuman: t.rangkuman,
    },

    praktikPedagogis: {
      modelPembelajaran: t.model,
      alasanModel: t.alasanModel,
      pendekatan: "Pembelajaran Mendalam (memahami — mengaplikasi — merefleksi)",
      metode: t.metode,
      sintaks: t.sintaks ?? [],
      lintasDisiplin: t.lintasDisiplin,
    },

    lingkunganPembelajaran: j([t.lingkungan, t.digital, t.kemitraan]),
    media,
    sumberBelajar: t.daftarPustaka ?? [],
    diferensiasi: j([t.kebutuhanBelajar, t.minatBelajar]),

    asesmenAwal: t.asesmen?.diagnostik ?? [],
    asesmenFormatif: t.asesmen?.formatif ?? [],
    asesmenSumatif: t.asesmen?.sumatif ?? [],
    kktp: (t.tp ?? []).map((x) => ({ kodeTp: x.kode, kriteria: x.kktp })),
    kisi: t.kisi ?? [],
    soal: t.soal ?? { pg: [], uraian: [] },
    rubrik: t.rubrik ?? [],

    pengalamanBelajar: (t.pertemuanRinci ?? []).map((p, i) => ({
      pertemuan: p.pertemuan || i + 1,
      pemantik: t.pertanyaanPemantik?.[i] ?? t.pertanyaanPemantik?.[0] ?? "",
      awal: p.awal,
      memahami: p.memahami,
      mengaplikasi: p.mengaplikasi,
      merefleksi: p.merefleksi,
      penutup: p.penutup,
    })),

    lkpd: t.lkpd ?? { alatBahan: [], langkah: [], pertanyaan: [] },

    refleksi: { guru: t.refleksiGuru ?? [], siswa: t.refleksiSiswa ?? [] },
    tindakLanjut: { remedial: t.remedial, pengayaan: t.pengayaan },
    lampiran: { glosarium: t.glosarium ?? [], daftarPustaka: t.daftarPustaka ?? [] },
    ringkasanModul: {
      tp: (t.tp ?? []).map((x, i) => `${i + 1}. ${x.rumusan}`).join("\n"),
      alur: (t.pertemuanRinci ?? [])
        .map(
          (p) =>
            `Pertemuan ${p.pertemuan}: Memahami ${p.memahami[0]?.siswa ?? "-"} → Mengaplikasi ${
              p.mengaplikasi[0]?.siswa ?? "-"
            } → Merefleksi ${p.merefleksi[0]?.siswa ?? "-"}`,
        )
        .join("\n"),
      asesmen: j((t.asesmen?.sumatif ?? []).map((s) => s.soal)),
      pemahamanBermakna: t.pemahamanBermakna,
    },
  };
}

/** Bentuk MASTER_KURIKULUM dari hasil Analisis CP (Master Data) + identitas form. */
export function buildMasterKurikulum(master: MasterData, ctx: DocContextType): MasterKurikulum {
  return {
    version: 1,
    identitas: {
      namaSekolah: ctx.satuan,
      guru: ctx.penyusun,
      mapel: ctx.mapel,
      jenjang: ctx.jenjang,
      fase: ctx.fase,
      kelas: ctx.kelas,
      semester: ctx.semester,
      tahunAjaran: ctx.tahunAjaran,
    },
    cp: ctx.cp, // CP ditempel apa adanya
    alokasiPerPertemuan: ctx.alokasiPerPertemuan,
    units: (master.topics ?? []).map((t) => toUnit(t, ctx)),
  };
}

/** Unit terpilih (fallback ke unit pertama). Dipakai semua dokumen topik-spesifik. */
export function unitOf(mk: MasterKurikulum, topicNo?: number): MkUnit | undefined {
  return (topicNo ? mk.units.find((u) => u.no === topicNo) : undefined) ?? mk.units[0];
}

/** Sidik CP: dipakai untuk mendeteksi perubahan CP → Master Kurikulum baru. */
export function cpFingerprint(cp: string): string {
  const s = cp.replace(/\s+/g, " ").trim().toLowerCase();
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  return `${s.length.toString(36)}-${h1.toString(36)}`;
}
