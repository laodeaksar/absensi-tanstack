const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayStr = (tzOffsetMinutes?: number) =>
  tzOffsetMinutes == null
    ? fmt(new Date())
    : new Date(Date.now() + tzOffsetMinutes * 60_000)
        .toISOString()
        .slice(0, 10);

export const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};

/** Geser tanggal yyyy-MM-dd sebanyak `days` hari (boleh negatif). */
export function shiftDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + days));
}

/** Selisih hari b - a (b setelah a => positif). */
export function daysBetween(a: string, b: string) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000,
  );
}

/** true jika string benar-benar tanggal kalender (2025-02-30 -> false). */
export function isRealDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const y = +m[1],
    mo = +m[2],
    d = +m[3];
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  );
}

/* ---------- format tampilan (satu tempat untuk semua halaman) ---------- */

const idDate = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const idDateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const YMD = /^(\d{4})-(\d{2})-(\d{2})/;
const YMD_HM = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

type DateInput = string | number | null | undefined;

/**
 * Tampilkan tanggal: "03 Nov 2026".
 * Menerima "yyyy-MM-dd" (juga yang berekor jam/ISO) atau epoch ms. Kosong/tidak valid -> "-".
 * String yyyy-MM-dd dibaca sebagai tanggal lokal agar tidak bergeser sehari oleh zona waktu.
 */
export function formatDate(v: DateInput) {
  if (v === "" || v == null) return "-";
  if (typeof v === "string") {
    const m = YMD.exec(v);
    if (m) return idDate.format(new Date(+m[1], +m[2] - 1, +m[3]));
  }
  const d = new Date(Number(v));
  return Number.isNaN(d.getTime()) ? "-" : idDate.format(d);
}

/**
 * Tampilkan tanggal dan jam: "03 Nov 2026 14.05".
 * Menerima "yyyy-MM-ddTHH:mm" (tenggat), epoch ms (waktu kumpul), atau string numerik epoch.
 */
export function formatDateTime(v: DateInput) {
  if (v === "" || v == null) return "-";
  if (typeof v === "string") {
    const m = YMD_HM.exec(v);
    if (m)
      return idDateTime.format(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  }
  const d = new Date(Number(v));
  return Number.isNaN(d.getTime()) ? "-" : idDateTime.format(d);
}
