import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CpAnalysisInputType = {
  jenjang: string;
  kelas: string;
  fase: string;
  mapel: string;
  semester: string;
  cp: string;
  alokasiPerPertemuan: string;
};

export type CpTopic = {
  no: number;
  materi: string;
  kompetensi: string;
  pertemuan: number;
  alokasi: string;
};
export type MasterActivity = { guru: string; siswa: string; media: string; alokasi: string };

export type MasterTopic = CpTopic & {
  fokusBelajar: string;
  tingkatKesulitan: string;
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

export type MasterData = CpAnalysisInputType & {
  mainCompetencies?: string[];
  supportingCompetencies?: string[];
  topics: MasterTopic[];
};

export const analyzeCP = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        jenjang: z.string().trim().min(1),
        kelas: z.string().trim().min(1),
        fase: z.string().trim().min(1),
        mapel: z.string().trim().min(1),
        semester: z.string().trim().min(1),
        cp: z.string().trim().min(1),
        alokasiPerPertemuan: z.string().trim().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { executeCpAnalysis } = await import("./cp-analysis.server");
    return executeCpAnalysis(data);
  });
