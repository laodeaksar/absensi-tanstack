import { z } from 'zod'
import type { Student } from './types'

export interface StudentRules {
  /** Semua siswa yang ada (untuk cek NIS/NISN ganda) */
  students: Student[]
  /** student_id yang sedang diedit; kosong = siswa baru */
  editingId?: string
  /** Kelas aktif yang boleh dipilih saat menambah siswa */
  classIds: string[]
}

/** Cerminan saveStudent di backend + syarat pembuatan akun (NIS >= 3 karakter dipakai sebagai username). */
export function makeStudentSchema(rules: StudentRules) {
  const isNew = !rules.editingId
  const holder = (field: 'nis' | 'nisn', value: string) =>
    rules.students.find((s) => s.student_id !== rules.editingId && String(s[field] ?? '') === value)

  return z
    .object({
      nis: z
        .string()
        .trim()
        .min(1, 'NIS wajib diisi')
        .min(3, 'NIS minimal 3 karakter (dipakai sebagai username siswa)')
        .max(20, 'NIS maksimal 20 karakter'),
      nisn: z.string().trim().min(1, 'NISN wajib diisi').regex(/^\d{10}$/, 'NISN harus 10 digit angka'),
      full_name: z.string().trim().min(1, 'Nama lengkap wajib diisi').min(3, 'Nama minimal 3 karakter').max(100, 'Nama maksimal 100 karakter'),
      gender: z.string().refine((v) => v === 'L' || v === 'P', 'Pilih jenis kelamin'),
      class_id: z.string(),
    })
    .superRefine((v, ctx) => {
      const nis = v.nis.trim()
      const nisn = v.nisn.trim()
      const nisOwner = nis ? holder('nis', nis) : undefined
      if (nisOwner) ctx.addIssue({ code: 'custom', path: ['nis'], message: `NIS sudah dipakai oleh ${nisOwner.full_name}` })
      const nisnOwner = nisn ? holder('nisn', nisn) : undefined
      if (nisnOwner) ctx.addIssue({ code: 'custom', path: ['nisn'], message: `NISN sudah dipakai oleh ${nisnOwner.full_name}` })

      if (isNew) {
        if (!v.class_id) ctx.addIssue({ code: 'custom', path: ['class_id'], message: 'Pilih kelas terlebih dahulu' })
        else if (!rules.classIds.includes(v.class_id)) ctx.addIssue({ code: 'custom', path: ['class_id'], message: 'Kelas tidak valid' })
      }
    })
}