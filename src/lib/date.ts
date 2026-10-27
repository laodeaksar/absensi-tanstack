const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayStr = () => fmt(new Date())

export const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

/** Geser tanggal yyyy-MM-dd sebanyak `days` hari (boleh negatif). */
export function shiftDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + days))
}

/** Selisih hari b - a (b setelah a => positif). */
export function daysBetween(a: string, b: string) {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/** true jika string benar-benar tanggal kalender (2025-02-30 -> false). */
export function isRealDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return false
  const y = +m[1], mo = +m[2], d = +m[3]
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}