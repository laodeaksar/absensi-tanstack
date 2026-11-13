// Simpan sebagai convex/rules.ts
// Aturan murni yang dipakai bersama oleh server (Convex) dan skema zod di klien.
// Jangan mengimpor apa pun dari "convex/server" atau "./_generated/*": klien mengimpornya lewat "~/convex/rules".

/* ---------- format data ---------- */

export const RULES = {
  username: /^[A-Za-z0-9._-]{3,30}$/,
  nip: /^[0-9]{5,30}$/,
  phone: /^[0-9+][0-9\s-]{5,19}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  nisn: /^\d{10}$/,
  /** Kode mata pelajaran, mis. MTK, B.IND; disimpan huruf besar */
  subjectCode: /^[A-Za-z0-9._-]{2,10}$/,
} as const;

/** 2025/2026: dua tahun berurutan. */
export function isAcademicYear(v: string) {
  const m = /^(\d{4})\/(\d{4})$/.exec(v.trim());
  return !!m && Number(m[2]) === Number(m[1]) + 1;
}

/* ---------- absensi dan laporan ---------- */

export const STATUS_VALUES = ["Hadir", "Sakit", "Izin", "Alpa"] as const;

/** Rentang laporan maksimal (hari). Dicek di klien (rangeIssue) dan di server. */
export const MAX_RANGE_DAYS = 366;

/* ---------- kebijakan password kuat ---------- */
// Dipakai saat MEMBUAT atau MENGGANTI password (guru baru, ganti password).
// Jangan dipakai di form login: akun lama dan password awal siswa (NISN) harus tetap bisa masuk.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

const COMMON = [
  "password",
  "passw0rd",
  "qwerty",
  "qwertyuiop",
  "asdfgh",
  "zxcvbn",
  "letmein",
  "welcome",
  "iloveyou",
  "abc123",
  "123456",
  "12345678",
  "111111",
  "000000",
  "admin",
  "guru",
  "siswa",
  "sekolah",
  "rahasia",
  "bismillah",
  "indonesia",
];

export interface PolicyContext {
  /** Data yang tidak boleh muncul di password: username, nama, NIP, no. HP, dst. */
  forbidden?: (string | undefined | null)[];
}

export interface PolicyRule {
  id: string;
  /** Label singkat untuk daftar syarat */
  label: string;
  /** Pesan error saat gagal */
  message: string;
  ok: boolean;
}

const tokensOf = (s?: string | null) =>
  String(s ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

/** Cek semua aturan; hasilnya dipakai untuk validasi zod dan indikator kekuatan. */
export function evaluatePassword(pw: string, ctx: PolicyContext = {}) {
  const low = pw.toLowerCase();
  const personal = (ctx.forbidden ?? []).flatMap((f) => {
    const whole = String(f ?? "")
      .toLowerCase()
      .replace(/\s+/g, "");
    return [...tokensOf(f), ...(whole.length >= 3 ? [whole] : [])];
  });
  const hasPersonal = personal.some((t) => low.includes(t));
  const hasCommon = COMMON.some((c) => low.includes(c));

  const rules: PolicyRule[] = [
    {
      id: "len",
      label: `Minimal ${PASSWORD_MIN} karakter`,
      message: `Minimal ${PASSWORD_MIN} karakter`,
      ok: pw.length >= PASSWORD_MIN,
    },
    {
      id: "lower",
      label: "Huruf kecil (a-z)",
      message: "Harus mengandung huruf kecil",
      ok: /[a-z]/.test(pw),
    },
    {
      id: "upper",
      label: "Huruf besar (A-Z)",
      message: "Harus mengandung huruf besar",
      ok: /[A-Z]/.test(pw),
    },
    {
      id: "digit",
      label: "Angka (0-9)",
      message: "Harus mengandung angka",
      ok: /[0-9]/.test(pw),
    },
    {
      id: "symbol",
      label: "Simbol (!@#$...)",
      message: "Harus mengandung simbol, misalnya !@#$%",
      ok: /[^A-Za-z0-9]/.test(pw),
    },
    {
      id: "common",
      label: "Bukan kata umum / pola mudah",
      message: "Terlalu umum atau mudah ditebak",
      ok: !hasCommon && !/(.)\1{3,}/.test(pw),
    },
    {
      id: "personal",
      label: "Tidak memuat username / nama",
      message: "Tidak boleh memuat username, nama, NIP, atau data pribadi lain",
      ok: !hasPersonal,
    },
  ];

  const score = rules.filter((r) => r.ok).length;
  const ok = score === rules.length && pw.length <= PASSWORD_MAX;
  const level: "Lemah" | "Sedang" | "Kuat" | "Sangat kuat" = !ok
    ? score >= 6
      ? "Sedang"
      : "Lemah"
    : pw.length >= 12
      ? "Sangat kuat"
      : "Kuat";
  return { rules, score, ok, level };
}

/** Daftar pesan error (kosong = lolos). */
export function passwordIssues(pw: string, ctx: PolicyContext = {}): string[] {
  const issues = evaluatePassword(pw, ctx)
    .rules.filter((r) => !r.ok)
    .map((r) => r.message);
  if (pw.length > PASSWORD_MAX)
    issues.push(`Maksimal ${PASSWORD_MAX} karakter`);
  return issues;
}

/** Untuk server: pelanggaran pertama sebagai kalimat utuh ("Password minimal 8 karakter."), atau null bila lolos. */
export function passwordIssue(
  pw: string,
  forbidden: PolicyContext["forbidden"] = [],
): string | null {
  const issue = passwordIssues(pw, { forbidden })[0];
  if (!issue) return null;
  return `Password ${issue.charAt(0).toLowerCase()}${issue.slice(1)}.`;
}

export type Semester = "ganjil" | "genap";
export const SEMESTER_LABEL: Record<Semester, string> = {
  ganjil: "Ganjil",
  genap: "Genap",
};

/** "07-15": bulan-tanggal yang nyata (29 Feb sah). */
export function isMonthDay(v: string) {
  const m = /^(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  const dt = new Date(Date.UTC(2024, mo - 1, d)); // 2024 kabisat
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Semester dan tahun ajaran untuk sebuah tanggal (yyyy-MM-dd).
 * Syarat: genapStart < ganjilStart dalam satu tahun kalender (mis. "01-12" dan "07-15").
 */
export function periodFor(
  date: string,
  ganjilStart: string,
  genapStart: string,
): { academicYear: string; semester: Semester } {
  const y = Number(date.slice(0, 4));
  const md = date.slice(5, 10);
  if (md >= ganjilStart)
    return { academicYear: `${y}/${y + 1}`, semester: "ganjil" };
  if (md >= genapStart)
    return { academicYear: `${y - 1}/${y}`, semester: "genap" };
  return { academicYear: `${y - 1}/${y}`, semester: "ganjil" };
}

export type GradeComponent = {
  key: string;
  label: string;
  weight: number;
  source: "tugas" | "manual";
};
export const DEFAULT_KKM = 75;
export const DEFAULT_GRADE_COMPONENTS: GradeComponent[] = [
  { key: "tugas", label: "Tugas", weight: 40, source: "tugas" },
  { key: "uts", label: "UTS", weight: 30, source: "manual" },
  { key: "uas", label: "UAS", weight: 30, source: "manual" },
];
//export const GRADE_LIMITS = { maxComponents: 6 };

/**
 * Nilai akhir berbobot. Komponen yang belum bernilai dilewati dan bobotnya dinormalisasi,
 * lalu complete = false (nilai sementara).
 */
export function finalScore(
  components: GradeComponent[],
  values: Record<string, number | null | undefined>,
) {
  let sum = 0;
  let weight = 0;
  let missing = 0;
  for (const c of components) {
    const v = values[c.key];
    if (v === null || v === undefined) {
      missing++;
      continue;
    }
    sum += v * c.weight;
    weight += c.weight;
  }
  return {
    final: weight > 0 ? Math.round((sum / weight) * 100) / 100 : null,
    complete: components.length > 0 && missing === 0,
  };
}

export const predicateFor = (score: number, kkm: number) =>
  score < kkm ? "D" : score >= 90 ? "A" : score >= 80 ? "B" : "C";
