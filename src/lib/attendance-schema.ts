import { z } from 'zod'
import { isRealDate, shiftDays, todayStr } from './date'

export const STATUS_VALUES = ['Hadir', 'Sakit', 'Izin', 'Alpa'] as const

/** Status yang mewajibkan keterangan. Ubah di sini untuk mengatur aturan. */
export const NOTES_REQUIRED: readonly string[] = ['Sakit', 'Izin']
export const NOTES_MIN = 3
export const NOTES_MAX = 200

export const needsNotes = (status: string) => NOTES_REQUIRED.includes(status)

/* ---------- filter (tanggal + kelas): aturan bergantung peran, kelas, dan pengaturan ---------- */

export interface FilterRules {
  /** Daftar kelas yang boleh dipilih pengguna ini */
  classIds: string[]
  /** true untuk guru: tidak boleh tanggal masa depan dan dibatasi jendela edit */
  restricted: boolean
  /** edit_window_days dari pengaturan; 0 = tanpa batas */
  editWindowDays: number
}

export const earliestDate = (r: Pick<FilterRules, 'restricted' | 'editWindowDays'>) =>
  r.restricted && r.editWindowDays > 0 ? shiftDays(todayStr(), -r.editWindowDays) : undefined

/** Cerminan assertAttendanceEditable di backend, supaya error muncul sebelum request. */
export function makeFilterSchema(rules: FilterRules) {
  const today = todayStr()
  const earliest = earliestDate(rules)

  return z.object({
    date: z
      .string()
      .min(1, 'Tanggal wajib diisi')
      .refine((d) => !d || isRealDate(d), 'Tanggal tidak valid')
      .refine((d) => !rules.restricted || !isRealDate(d) || d <= today, 'Tidak dapat mengisi absensi untuk tanggal yang akan datang')
      .refine(
        (d) => !earliest || !isRealDate(d) || d >= earliest,
        `Guru hanya dapat mengisi atau mengubah absensi maksimal ${rules.editWindowDays} hari ke belakang`,
      ),
    classId: z
      .string()
      .min(1, 'Pilih kelas')
      .refine((id) => !id || rules.classIds.includes(id), 'Kelas tidak tersedia untuk akun Anda'),
  })
}

/* ---------- grid absensi: aturan per baris bergantung status ---------- */

export const rowSchema = z
  .object({
    student_id: z.string(),
    nis: z.string(),
    full_name: z.string(),
    // '' = belum diisi (tidak disimpan)
    status: z.string().refine((v) => v === '' || (STATUS_VALUES as readonly string[]).includes(v), 'Status tidak valid'),
    notes: z.string().max(NOTES_MAX, `Maksimal ${NOTES_MAX} karakter`),
  })
  .superRefine((row, ctx) => {
    if (needsNotes(row.status) && row.notes.trim().length < NOTES_MIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['notes'],
        message: `Keterangan wajib untuk status ${row.status} (min. ${NOTES_MIN} karakter)`,
      })
    }
  })

export const gridSchema = z.object({ rows: z.array(rowSchema) })

/** Ambil pesan pertama dari daftar error TanStack Form (string atau issue standard schema). */
export function firstMessage(errors: unknown[]): string {
  const e = errors.find(Boolean)
  if (!e) return ''
  return typeof e === 'string' ? e : ((e as { message?: string }).message ?? '')
}