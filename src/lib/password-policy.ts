/**
 * Kebijakan password kuat. Dipakai saat MEMBUAT atau MENGGANTI password
 * (guru baru, ganti password). Jangan dipakai di form login: akun lama dan
 * password awal siswa (NISN) harus tetap bisa masuk.
 *
 * Aturan yang sama harus ada di backend (lihat Password-patch.gs).
 */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 100

const COMMON = [
  'password', 'passw0rd', 'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'letmein', 'welcome',
  'iloveyou', 'abc123', '123456', '12345678', '111111', '000000',
  'admin', 'guru', 'siswa', 'sekolah', 'rahasia', 'bismillah', 'indonesia',
]

export interface PolicyContext {
  /** Data yang tidak boleh muncul di password: username, nama, NIP, no. HP, dst. */
  forbidden?: (string | undefined | null)[]
}

export interface PolicyRule {
  id: string
  /** Label singkat untuk daftar syarat */
  label: string
  /** Pesan error saat gagal */
  message: string
  ok: boolean
}

const tokensOf = (s?: string | null) =>
  String(s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)

/** Cek semua aturan; hasilnya dipakai untuk validasi zod dan indikator kekuatan. */
export function evaluatePassword(pw: string, ctx: PolicyContext = {}) {
  const low = pw.toLowerCase()
  const personal = (ctx.forbidden ?? []).flatMap((f) => {
    const whole = String(f ?? '').toLowerCase().replace(/\s+/g, '')
    return [...tokensOf(f), ...(whole.length >= 3 ? [whole] : [])]
  })
  const hasPersonal = personal.some((t) => low.includes(t))
  const hasCommon = COMMON.some((c) => low.includes(c))

  const rules: PolicyRule[] = [
    { id: 'len', label: `Minimal ${PASSWORD_MIN} karakter`, message: `Minimal ${PASSWORD_MIN} karakter`, ok: pw.length >= PASSWORD_MIN },
    { id: 'lower', label: 'Huruf kecil (a-z)', message: 'Harus mengandung huruf kecil', ok: /[a-z]/.test(pw) },
    { id: 'upper', label: 'Huruf besar (A-Z)', message: 'Harus mengandung huruf besar', ok: /[A-Z]/.test(pw) },
    { id: 'digit', label: 'Angka (0-9)', message: 'Harus mengandung angka', ok: /[0-9]/.test(pw) },
    { id: 'symbol', label: 'Simbol (!@#$...)', message: 'Harus mengandung simbol, misalnya !@#$%', ok: /[^A-Za-z0-9]/.test(pw) },
    { id: 'common', label: 'Bukan kata umum / pola mudah', message: 'Terlalu umum atau mudah ditebak', ok: !hasCommon && !/(.)\1{3,}/.test(pw) },
    { id: 'personal', label: 'Tidak memuat username / nama', message: 'Tidak boleh memuat username, nama, NIP, atau data pribadi lain', ok: !hasPersonal },
  ]

  const score = rules.filter((r) => r.ok).length
  const ok = score === rules.length && pw.length <= PASSWORD_MAX
  const level: 'Lemah' | 'Sedang' | 'Kuat' | 'Sangat kuat' =
    !ok ? (score >= 6 ? 'Sedang' : 'Lemah') : pw.length >= 12 ? 'Sangat kuat' : 'Kuat'
  return { rules, score, ok, level }
}

/** Daftar pesan error (kosong = lolos). */
export function passwordIssues(pw: string, ctx: PolicyContext = {}): string[] {
  const issues = evaluatePassword(pw, ctx).rules.filter((r) => !r.ok).map((r) => r.message)
  if (pw.length > PASSWORD_MAX) issues.push(`Maksimal ${PASSWORD_MAX} karakter`)
  return issues
}