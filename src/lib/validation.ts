import { daysBetween, isRealDate } from './date'

/** Rentang laporan maksimal (hari) agar permintaan tidak terlalu berat. */
export const MAX_RANGE_DAYS = 366

/** Pesan error rentang tanggal, atau null jika valid / belum lengkap. Dipasang di path `endDate`. */
export function rangeIssue(start: string, end: string, maxDays = MAX_RANGE_DAYS): string | null {
  if (!start || !end || !isRealDate(start) || !isRealDate(end)) return null
  const span = daysBetween(start, end)
  if (span < 0) return 'Tanggal awal tidak boleh melebihi tanggal akhir'
  if (span + 1 > maxDays) return `Rentang maksimal ${maxDays} hari`
  return null
}

/** Pesan pertama dari daftar error TanStack Form (string atau issue standard schema). */
export function firstMessage(errors: unknown[]): string {
  const e = errors.find(Boolean)
  if (!e) return ''
  return typeof e === 'string' ? e : ((e as { message?: string }).message ?? '')
}