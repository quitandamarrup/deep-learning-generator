import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import JSZip from "jszip";

// --- Very small Markdown parser for our AI output (headings/lists/tables/paragraphs) ---
type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "li"; ordered: boolean; text: string }
  | { type: "table"; rows: string[][] };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    // Table
    if (line.includes("|") && lines[i + 1] && /^[\s|:-]+$/.test(lines[i + 1])) {
      const header = line.split("|").map((c) => c.trim()).filter((_, idx, a) => !(idx === 0 && a[0] === "") && !(idx === a.length - 1 && a[a.length - 1] === ""));
      const rows: string[][] = [header];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const cells = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, a) => !(idx === 0 && a[0] === "") && !(idx === a.length - 1 && a[a.length - 1] === ""));
        rows.push(cells);
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    // List
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ol) {
      blocks.push({ type: "li", ordered: true, text: ol[2] });
      i++;
      continue;
    }
    if (ul) {
      blocks.push({ type: "li", ordered: false, text: ul[1] });
      i++;
      continue;
    }
    // Paragraph (join until blank)
    let p = line;
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*+]\s|\d+\.\s)/.test(lines[i]) && !lines[i].includes("|")) {
      p += " " + lines[i].trim();
      i++;
    }
    blocks.push({ type: "p", text: p.trim() });
  }
  return blocks;
}

// Strip simple inline markdown (**bold**, *italic*, `code`)
function stripInline(s: string): { text: string; bold?: boolean }[] {
  const out: { text: string; bold?: boolean }[] = [];
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const m = /^\*\*(.+)\*\*$/.exec(part);
    if (m) out.push({ text: m[1], bold: true });
    else out.push({ text: part.replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1") });
  }
  return out;
}

function runsFromInline(s: string): TextRun[] {
  return stripInline(s).map((seg) => new TextRun({ text: seg.text, bold: seg.bold }));
}

// --- DOCX ---
export async function downloadDocx(filename: string, markdown: string, title: string) {
  const blocks = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
    new Paragraph({ text: "" }),
  );

  const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  for (const b of blocks) {
    if (b.type === "h") {
      children.push(
        new Paragraph({
          heading: headingLevels[Math.min(b.level, 6) - 1],
          children: [new TextRun({ text: b.text, bold: true })],
        }),
      );
    } else if (b.type === "p") {
      children.push(new Paragraph({ children: runsFromInline(b.text) }));
    } else if (b.type === "li") {
      children.push(
        new Paragraph({
          bullet: b.ordered ? undefined : { level: 0 },
          numbering: undefined,
          children: [new TextRun({ text: (b.ordered ? "• " : "") + b.text })],
        }),
      );
    } else if (b.type === "table") {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: b.rows.map(
          (r, ri) =>
            new TableRow({
              children: r.map(
                (c) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: c, bold: ri === 0 })],
                      }),
                    ],
                  }),
              ),
            }),
        ),
      });
      children.push(table);
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
}

// --- PDF (jsPDF text mode) ---
export function downloadPdf(filename: string, markdown: string, title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const writeLine = (text: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 11);
    const indent = opts.indent ?? 0;
    const wrapped = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of wrapped) {
      ensure((opts.size ?? 11) + 4);
      doc.text(line, margin + indent, y);
      y += (opts.size ?? 11) + 4;
    }
  };

  writeLine(title, { bold: true, size: 16 });
  y += 8;

  const blocks = parseMarkdown(markdown);
  for (const b of blocks) {
    if (b.type === "h") {
      y += 6;
      writeLine(b.text, { bold: true, size: b.level <= 2 ? 14 : 12 });
      y += 2;
    } else if (b.type === "p") {
      writeLine(b.text);
      y += 4;
    } else if (b.type === "li") {
      writeLine((b.ordered ? "• " : "• ") + b.text, { indent: 12 });
    } else if (b.type === "table") {
      // Simple rendering: header row bold, rest normal, columns delimited by " | "
      for (let ri = 0; ri < b.rows.length; ri++) {
        writeLine(b.rows[ri].join(" | "), { bold: ri === 0, size: 10 });
      }
      y += 6;
    }
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function downloadZipOfDocs(
  zipName: string,
  docs: { key: string; filename: string; markdown: string; title: string }[],
  format: "docx" | "pdf",
) {
  const zip = new JSZip();
  if (format === "docx") {
    for (const d of docs) {
      const blocks = parseMarkdown(d.markdown);
      const children: (Paragraph | Table)[] = [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: d.title, bold: true, size: 32 })],
        }),
        new Paragraph({ text: "" }),
      ];
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ];
      for (const b of blocks) {
        if (b.type === "h") {
          children.push(
            new Paragraph({
              heading: headingLevels[Math.min(b.level, 6) - 1],
              children: [new TextRun({ text: b.text, bold: true })],
            }),
          );
        } else if (b.type === "p") {
          children.push(new Paragraph({ children: runsFromInline(b.text) }));
        } else if (b.type === "li") {
          children.push(
            new Paragraph({
              bullet: b.ordered ? undefined : { level: 0 },
              children: [new TextRun({ text: (b.ordered ? "• " : "") + b.text })],
            }),
          );
        } else if (b.type === "table") {
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: b.rows.map(
                (r, ri) =>
                  new TableRow({
                    children: r.map(
                      (c) =>
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: c, bold: ri === 0 })],
                            }),
                          ],
                        }),
                    ),
                  }),
              ),
            }),
          );
          children.push(new Paragraph({ text: "" }));
        }
      }
      const docx = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(docx);
      const buf = await blob.arrayBuffer();
      zip.file(`${d.filename}.docx`, buf);
    }
  } else {
    for (const d of docs) {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      let y = margin;
      const ensure = (h: number) => {
        if (y + h > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const writeLine = (text: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) => {
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(opts.size ?? 11);
        const indent = opts.indent ?? 0;
        const wrapped = doc.splitTextToSize(text, maxWidth - indent);
        for (const line of wrapped) {
          ensure((opts.size ?? 11) + 4);
          doc.text(line, margin + indent, y);
          y += (opts.size ?? 11) + 4;
        }
      };
      writeLine(d.title, { bold: true, size: 16 });
      y += 8;
      for (const b of parseMarkdown(d.markdown)) {
        if (b.type === "h") {
          y += 6;
          writeLine(b.text, { bold: true, size: b.level <= 2 ? 14 : 12 });
        } else if (b.type === "p") {
          writeLine(b.text);
          y += 4;
        } else if (b.type === "li") {
          writeLine("• " + b.text, { indent: 12 });
        } else if (b.type === "table") {
          for (let ri = 0; ri < b.rows.length; ri++) {
            writeLine(b.rows[ri].join(" | "), { bold: ri === 0, size: 10 });
          }
          y += 6;
        }
      }
      const buf = doc.output("arraybuffer");
      zip.file(`${d.filename}.pdf`, buf);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}
