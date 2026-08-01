#!/usr/bin/env python3
"""
Membuat TEMPLATE MASTER bertoken dari file Template Modul Ajar (DOCX) asli.

Skrip ini HANYA mengganti teks placeholder "[...]" pada template menjadi token
"{{NAMA}}" tanpa mengubah struktur, style, tabel, border, font, margin, header,
footer, atau layout apa pun. Blok "Pertemuan 2" dan "Pertemuan 3" dihapus karena
blok "Pertemuan 1" dipakai sebagai blok berulang ({{#PERTEMUAN}} ... {{/PERTEMUAN}}).

Pemakaian:
  python3 scripts/build-modul-ajar-template.py <template-asli.docx> public/templates/modul-ajar-2025.docx
"""
import re
import shutil
import sys
import zipfile

# indeks paragraf (urutan dokumen) -> token pengganti
PARA_TOKENS = {
    5: "{{MAPEL}}",
    7: "{{FASE_KELAS}}",
    9: "{{TOPIK}}",
    11: "{{ALOKASI}}",
    13: "{{PENYUSUN}}",
    18: "{{JUDUL_MODUL}}",
    20: "{{MAPEL}}",
    22: "{{FASE_KELAS}}",
    24: "{{ALOKASI}}",
    26: "{{PROFIL_LULUSAN}}",
    28: "{{KARAKTERISTIK}}",
    35: "{{CP_ELEMEN}}",
    36: "{{CP}}",
    43: "{{TP1_RUMUSAN}}",
    44: "{{TP1_INDIKATOR}}",
    45: "{{TP1_BUKTI}}",
    47: "{{TP2_RUMUSAN}}",
    48: "{{TP2_INDIKATOR}}",
    49: "{{TP2_BUKTI}}",
    51: "{{TP3_RUMUSAN}}",
    52: "{{TP3_INDIKATOR}}",
    53: "{{TP3_BUKTI}}",
    58: "{{MATERI_INTI}}",
    60: "{{PRAKTIK_PEDAGOGIS}}",
    62: "{{LINGKUNGAN}}",
    64: "{{DIFERENSIASI}}",
    74: "{{DIAG_TEKNIK}}",
    76: "{{DIAG_TINDAK}}",
    79: "{{FORM_TEKNIK}}",
    81: "{{FORM_TINDAK}}",
    84: "{{SUM_TEKNIK}}",
    86: "{{SUM_TINDAK}}",
    93: "{{RUB1_IND}}",
    94: "{{RUB1_MB}}",
    95: "{{RUB1_BSH}}",
    96: "{{RUB1_SB}}",
    97: "{{RUB1_CATATAN}}",
    98: "{{RUB2_IND}}",
    99: "{{RUB2_MB}}",
    100: "{{RUB2_BSH}}",
    101: "{{RUB2_SB}}",
    102: "{{RUB2_CATATAN}}",
    103: "{{RUB3_IND}}",
    104: "{{RUB3_MB}}",
    105: "{{RUB3_BSH}}",
    106: "{{RUB3_SB}}",
    107: "{{RUB3_CATATAN}}",
    108: "{{RUB4_IND}}",
    109: "{{RUB4_MB}}",
    110: "{{RUB4_BSH}}",
    111: "{{RUB4_SB}}",
    112: "{{RUB4_CATATAN}}",
    # blok pertemuan (dipakai berulang)
    116: "{{#PERTEMUAN}}Pertemuan {{P_NO}}: {{P_SUBTOPIK}}",
    117: "Pertanyaan Pemantik: {{P_PEMANTIK}}",
    119: "{{P_PENDAHULUAN_1}}",
    120: "{{P_PENDAHULUAN_2}}",
    127: "{{P_MEMAHAMI_AKT}}",
    128: "{{P_MEMAHAMI_PRODUK}}",
    129: "{{P_MEMAHAMI_ASESMEN}}",
    131: "{{P_MENGAPLIKASI_AKT}}",
    132: "{{P_MENGAPLIKASI_PRODUK}}",
    133: "{{P_MENGAPLIKASI_ASESMEN}}",
    135: "{{P_MEREFLEKSI_AKT}}",
    136: "{{P_MEREFLEKSI_PRODUK}}",
    137: "{{P_MEREFLEKSI_ASESMEN}}",
    139: "{{P_PENUTUP_1}}",
    140: "{{P_PENUTUP_2}}{{/PERTEMUAN}}",
    # lampiran
    204: "{{LAMP1_KET}}",
    207: "{{LAMP2_KET}}",
    210: "{{LAMP3_KET}}",
    216: "{{LAMP5_KET}}",
    219: "{{LAMP6_KET}}",
    # rubrik penilaian saja
    229: "{{RS1_TP}}",
    230: "{{RS1_IND}}",
    231: "{{RS1_MB}}",
    232: "{{RS1_BSH}}",
    233: "{{RS1_SB}}",
    234: "{{RS2_TP}}",
    235: "{{RS2_IND}}",
    236: "{{RS2_MB}}",
    237: "{{RS2_BSH}}",
    238: "{{RS2_SB}}",
    239: "{{RS3_TP}}",
    240: "{{RS3_IND}}",
    241: "{{RS3_MB}}",
    242: "{{RS3_BSH}}",
    243: "{{RS3_SB}}",
    # ringkasan 1 halaman
    248: "{{RINGKASAN_TP}}",
    250: "{{RINGKASAN_ALUR}}",
    252: "{{RINGKASAN_ASESMEN}}",
    # LKPD
    268: "{{MAPEL}}",
    270: "{{TOPIK}}",
    272: "{{LKPD_PERTEMUAN}}",
    274: "{{LKPD_TAHAP}}",
    278: "{{LKPD_TUJUAN}}",
    285: "{{LKPD_STIMULUS}}",
    291: "{{LKPD_TUGAS_1}}",
    294: "{{LKPD_TUGAS_2}}",
    297: "{{LKPD_TUGAS_3}}",
}

# blok pertemuan 2 dan 3 dihapus (paragraf 142..191 beserta tabel di dalamnya)
DROP_FROM_PARA, DROP_TO_PARA = 142, 191

PARA_RE = re.compile(r"<w:p(?: [^>]*)?>.*?</w:p>|<w:p(?: [^>]*)?/>", re.S)
RUN_RE = re.compile(r"<w:r(?: [^>]*)?>.*?</w:r>", re.S)


def set_paragraph_text(para: str, text: str) -> str:
    runs = list(RUN_RE.finditer(para))
    runs = [r for r in runs if "<w:t" in r.group(0)]
    if not runs:
        return para
    first = runs[0].group(0)
    esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    new_first = re.sub(
        r"<w:t(?: [^>]*)?>.*?</w:t>",
        f'<w:t xml:space="preserve">{esc}</w:t>',
        first,
        count=1,
        flags=re.S,
    )
    new_first = re.sub(r"(?<!\{)<w:t(?: [^>]*)?>.*?</w:t>", "", new_first, flags=re.S) if False else new_first
    # buang w:t tambahan di run pertama
    parts = re.findall(r"<w:t(?: [^>]*)?>.*?</w:t>", new_first, re.S)
    for extra in parts[1:]:
        new_first = new_first.replace(extra, "", 1)
    out = para.replace(first, new_first, 1)
    for r in runs[1:]:
        out = out.replace(r.group(0), "", 1)
    return out


def main() -> None:
    src, dest = sys.argv[1], sys.argv[2]
    with zipfile.ZipFile(src) as z:
        names = z.namelist()
        files = {n: z.read(n) for n in names}
    doc = files["word/document.xml"].decode("utf-8")

    spans = [(m.start(), m.end()) for m in PARA_RE.finditer(doc)]
    edits = []
    for idx, token in PARA_TOKENS.items():
        s, e = spans[idx]
        edits.append((s, e, set_paragraph_text(doc[s:e], token)))
    # hapus blok pertemuan 2 & 3: dari awal paragraf 142 sampai akhir paragraf 191
    drop_start = spans[DROP_FROM_PARA][0]
    drop_end = spans[DROP_TO_PARA][1]
    edits.append((drop_start, drop_end, ""))

    for s, e, rep in sorted(edits, key=lambda x: -x[0]):
        doc = doc[:s] + rep + doc[e:]

    files["word/document.xml"] = doc.encode("utf-8")
    shutil.rmtree(dest, ignore_errors=True) if False else None
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for n in names:
            z.writestr(n, files[n])
    print("template master bertoken:", dest)


if __name__ == "__main__":
    main()
