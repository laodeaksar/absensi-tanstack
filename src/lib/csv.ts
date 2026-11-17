/** Excel berlokal Indonesia memakai titik koma sebagai pemisah kolom. Ubah ke "," bila perlu. */
const CSV_DELIMITER = ";";

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number;
  /** Kolom angka yang harus tetap teks (NIS dengan 0 di depan tidak boleh dipangkas Excel). */
  text?: boolean;
};

function cell<T>(col: CsvColumn<T>, row: T): string {
  const raw = col.value(row);
  let s = String(raw ?? "");
  if (typeof raw === "string") {
    // Cegah injeksi rumus spreadsheet dari isian pengguna (mis. keterangan)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (col.text && /^\d+$/.test(s)) return `="${s}"`;
  }
  return /[",;\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Nama berkas aman: csvFilename("laporan-absensi", "2026-11-01", undefined) -> laporan-absensi_2026-11-01.csv */
export const csvFilename = (...parts: (string | undefined)[]) =>
  `${parts
    .filter(Boolean)
    .join("_")
    .replace(/[^\w.-]+/g, "-")}.csv`;

export function downloadCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
) {
  const lines = [
    columns
      .map((c) => cell({ header: "", value: () => c.header }, null as T))
      .join(CSV_DELIMITER),
    ...rows.map((r) => columns.map((c) => cell(c, r)).join(CSV_DELIMITER)),
  ];
  // BOM agar Excel membaca UTF-8 (nama dengan huruf khusus tidak rusak)
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
