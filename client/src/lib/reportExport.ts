// client/src/lib/reportExport.ts
// Export laporan ke CSV, Excel (.xlsx) dan PDF dari satu definisi laporan.
// Library Excel & PDF dimuat saat tombol diklik (dynamic import) agar
// halaman tidak menjadi berat.

export type ReportColumnType = "text" | "number" | "currency";

export type ReportCell = string | number | null;

export interface ReportColumn {
  header: string;
  type?:  ReportColumnType;
  width?: number; // lebar kolom Excel (karakter)
}

export interface ReportTable {
  title:     string;  // judul tabel di PDF
  sheetName: string;  // nama sheet Excel (maks. 31 karakter)
  columns:   ReportColumn[];
  rows:      ReportCell[][];
  totalRow?: ReportCell[];
}

export interface ReportDocument {
  title:    string;                   // judul laporan
  filename: string;                   // nama file tanpa ekstensi
  meta:     Array<[string, string]>;  // baris ringkasan (label, nilai)
  tables:   ReportTable[];            // tabel pertama = isi CSV
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

// ── Format ────────────────────────────────────────────────────────
export const formatRupiah = (n: number): string =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

// Tanggal lokal dalam format YYYY-MM-DD (bukan UTC dari toISOString)
export const toLocalISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatLongDate = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const nowLabel = (): string =>
  new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatCell = (value: ReportCell, type: ReportColumnType = "text"): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    if (type === "currency") return formatRupiah(value);
    return value.toLocaleString("id-ID");
  }
  return value;
};

// Font standar PDF tidak memuat beberapa karakter Unicode
const pdfSafe = (s: string): string =>
  s.replace(/[—–]/g, "-").replace(/[•·]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── CSV ───────────────────────────────────────────────────────────
// Angka ditulis apa adanya (tanpa "Rp" / titik ribuan) agar bisa dihitung.
// BOM UTF-8 ditambahkan agar huruf non-ASCII terbaca benar di Excel.
const csvEscape = (value: ReportCell): string => {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCSV = (report: ReportDocument): void => {
  const table = report.tables[0];
  if (!table) return;
  const lines = [
    table.columns.map((c) => csvEscape(c.header)).join(","),
    ...table.rows.map((row) => row.map(csvEscape).join(",")),
  ];
  if (table.totalRow) lines.push(table.totalRow.map(csvEscape).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${report.filename}.csv`);
};

// ── Excel (.xlsx) ─────────────────────────────────────────────────
const RUPIAH_FORMAT = '"Rp "#,##0';
const NUMBER_FORMAT = "#,##0";

export const exportExcel = async (report: ReportDocument): Promise<void> => {
  // exceljs berupa modul CommonJS: ambil Workbook dari named export,
  // cadangan lewat default (bergantung cara bundler membungkusnya)
  const mod = await import("exceljs");
  const Workbook =
    mod.Workbook ?? (mod as unknown as { default: typeof mod }).default.Workbook;
  const wb = new Workbook();
  wb.creator = "StockMate";
  wb.created = new Date();

  // Sheet ringkasan
  const summary = wb.addWorksheet("Ringkasan");
  summary.columns = [{ width: 28 }, { width: 48 }];
  summary.addRow([report.title]).font = { bold: true, size: 14 };
  summary.addRow([]);
  for (const [label, value] of report.meta) {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  }

  // Satu sheet per tabel
  for (const table of report.tables) {
    const ws = wb.addWorksheet(table.sheetName.slice(0, 31));
    ws.columns = table.columns.map((c) => ({
      header: c.header,
      width: c.width ?? Math.max(12, c.header.length + 4),
      style:
        c.type === "currency"
          ? { numFmt: RUPIAH_FORMAT }
          : c.type === "number"
            ? { numFmt: NUMBER_FORMAT }
            : {},
    }));

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC93E7B" } };
    header.alignment = { vertical: "middle" };

    for (const row of table.rows) ws.addRow(row.map((v) => (v === null ? "" : v)));

    if (table.totalRow) {
      const total = ws.addRow(table.totalRow.map((v) => (v === null ? "" : v)));
      total.font = { bold: true };
      total.border = { top: { style: "thin" } };
    }

    ws.views = [{ state: "frozen", ySplit: 1 }];
    if (table.rows.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + table.rows.length, column: table.columns.length },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${report.filename}.xlsx`
  );
};

// ── PDF ───────────────────────────────────────────────────────────
export const exportPDF = async (report: ReportDocument): Promise<void> => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Tabel lebar (banyak kolom) dicetak mendatar
  const maxColumns = Math.max(...report.tables.map((t) => t.columns.length), 0);
  const doc = new jsPDF({ orientation: maxColumns > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(pdfSafe(report.title), margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(pdfSafe(`Dicetak: ${nowLabel()}`), margin, 24);
  doc.setTextColor(0);

  // Ringkasan dua kolom tanpa garis
  autoTable(doc, {
    startY: 29,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    body: report.meta.map(([label, value]) => [pdfSafe(label), pdfSafe(value)]),
  });

  const lastY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;

  for (const table of report.tables) {
    let y = lastY() + 8;
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfSafe(table.title), margin, y);

    const alignOf = (c: ReportColumn) => (c.type === "currency" || c.type === "number" ? "right" : "left");

    autoTable(doc, {
      startY: y + 3,
      margin: { left: margin, right: margin },
      head: [table.columns.map((c) => pdfSafe(c.header))],
      body: table.rows.map((row) =>
        row.map((v, i) => pdfSafe(formatCell(v, table.columns[i]?.type)))
      ),
      // Sel kosong di baris total dibiarkan kosong (bukan "-")
      foot: table.totalRow
        ? [table.totalRow.map((v, i) =>
            v === null || v === "" ? "" : pdfSafe(formatCell(v, table.columns[i]?.type))
          )]
        : undefined,
      showFoot: "lastPage",
      styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [201, 62, 123], textColor: 255 },
      footStyles: { fillColor: [253, 230, 239], textColor: 20, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 248, 251] },
      // Rata kanan untuk kolom angka, berlaku juga untuk judul & baris total
      didParseCell: (cell) => {
        const col = table.columns[cell.column.index];
        if (col) cell.cell.styles.halign = alignOf(col);
      },
    });

    if (table.rows.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("Tidak ada data", margin, lastY() + 5);
    }
  }

  // Nomor halaman
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `StockMate - Halaman ${i} dari ${pages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }

  doc.save(`${report.filename}.pdf`);
};

export const exportReport = async (
  report: ReportDocument,
  format: ExportFormat
): Promise<void> => {
  if (format === "csv") return exportCSV(report);
  if (format === "xlsx") return exportExcel(report);
  return exportPDF(report);
};
