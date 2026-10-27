import { z } from 'zod'
import { passwordIssues } from './password-policy'
import type { Teacher } from './types'

export interface TeacherRules {
  /** Semua guru yang ada (untuk cek username/NIP ganda) */
  teachers: Teacher[]
  /** user_id yang sedang diedit; kosong = guru baru */
  editingId?: string
  /** Kelas yang boleh dipilih: kelas aktif + kelas yang sudah diampu */
  classIds: string[]
}

/** Cerminan saveTeacher di backend. Catatan: backend juga memeriksa NIP terhadap semua akun, bukan hanya guru. */
export function makeTeacherSchema(rules: TeacherRules) {
  const isNew = !rules.editingId
  const taken = (field: 'username' | 'nip', value: string) =>
    rules.teachers.some((t) => t.user_id !== rules.editingId && String(t[field] ?? '').toLowerCase() === value.toLowerCase())

  return z
    .object({
      full_name: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(100, 'Nama maksimal 100 karakter'),
      nip: z.string().trim().refine((v) => !v || /^[0-9]{5,30}$/.test(v), 'NIP hanya angka (5-30 digit)'),
      phone: z.string().trim().refine((v) => !v || /^[0-9+][0-9\s-]{5,19}$/.test(v), 'Nomor HP tidak valid'),
      email: z.string().trim().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Format email tidak valid'),
      username: z
        .string()
        .trim()
        .min(1, 'Username wajib diisi')
        .regex(/^[A-Za-z0-9._-]{3,30}$/, '3-30 karakter: huruf, angka, titik, garis bawah, atau strip'),
      password: z.string(),
      assigned_classes: z
        .array(z.string())
        .refine((ids) => ids.every((id) => rules.classIds.includes(id)), 'Ada kelas yang tidak valid'),
      is_active: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const username = v.username.trim()
      const nip = v.nip.trim()

      if (username && taken('username', username)) {
        ctx.addIssue({ code: 'custom', path: ['username'], message: 'Username sudah digunakan' })
      }
      if (nip && taken('nip', nip)) {
        ctx.addIssue({ code: 'custom', path: ['nip'], message: 'NIP sudah digunakan' })
      }

      // Password: wajib untuk guru baru, opsional saat edit; bila diisi harus kuat
      if (isNew && !v.password) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password wajib diisi untuk guru baru' })
      } else if (v.password) {
        const issue = passwordIssues(v.password, { forbidden: [username, v.full_name, nip, v.phone] })[0]
        if (issue) ctx.addIssue({ code: 'custom', path: ['password'], message: issue })
      }
    })
}