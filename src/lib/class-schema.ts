import { z } from 'zod'
import type { ClassRow } from './types'

export const CLASS_NAME_MAX = 50
export const GRADE_MAX = 20

/** 2025/2026: dua tahun berurutan. */
export function isAcademicYear(v: string) {
  const m = /^(\d{4})\/(\d{4})$/.exec(v.trim())
  return !!m && Number(m[2]) === Number(m[1]) + 1
}

export interface ClassRules {
  /** Semua kelas yang ada (untuk cek duplikat) */
  classes: ClassRow[]
  /** class_id yang sedang diedit (dikecualikan dari cek duplikat) */
  editingId?: string
  /** Wali kelas yang boleh dipilih: guru aktif + wali kelas saat ini bila sedang edit */
  teacherIds: string[]
}

/**
 * Cerminan validasi backend (saveClass), dibuat dari data terbaru:
 * - nama kelas unik per tahun ajaran
 * - wali kelas harus guru yang valid
 */
export function makeClassSchema(rules: ClassRules) {
  return z
    .object({
      class_name: z.string().trim().min(1, 'Nama kelas wajib diisi').max(CLASS_NAME_MAX, `Maksimal ${CLASS_NAME_MAX} karakter`),
      grade_level: z.string().trim().min(1, 'Tingkat wajib diisi').max(GRADE_MAX, `Maksimal ${GRADE_MAX} karakter`),
      academic_year: z
        .string()
        .trim()
        .min(1, 'Tahun ajaran wajib diisi')
        .refine((v) => !v || isAcademicYear(v), 'Format harus 2025/2026 (tahun berurutan)'),
      homeroom_teacher: z.string().refine((id) => !id || rules.teacherIds.includes(id), 'Wali kelas tidak valid'),
    })
    .superRefine((v, ctx) => {
      const name = v.class_name.trim()
      const year = v.academic_year.trim()
      if (!name || !year) return
      const dup = rules.classes.some(
        (c) => c.class_id !== rules.editingId && c.class_name === name && c.academic_year === year,
      )
      if (dup) {
        ctx.addIssue({
          code: 'custom',
          path: ['class_name'],
          message: `Kelas "${name}" sudah ada pada tahun ajaran ${year}`,
        })
      }
    })
}