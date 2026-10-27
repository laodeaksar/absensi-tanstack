import { z } from 'zod'
import { isAcademicYear } from './class-schema'
import { passwordIssues } from './password-policy'

/** Data sekolah + aturan absensi. Aturan lintas field: NIP kepala sekolah butuh nama. */
export const schoolSchema = z
  .object({
    school_name: z.string().trim().min(1, 'Nama sekolah wajib diisi').max(100, 'Maksimal 100 karakter'),
    school_address: z.string().trim().max(200, 'Maksimal 200 karakter'),
    principal_name: z.string().trim().max(100, 'Maksimal 100 karakter'),
    principal_nip: z.string().trim().refine((v) => !v || /^[0-9]{5,30}$/.test(v), 'NIP hanya angka (5-30 digit)'),
    active_academic_year: z.string().trim().refine((v) => !v || isAcademicYear(v), 'Format harus 2025/2026 (tahun berurutan)'),
    edit_window_days: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 365), 'Isi angka 0 sampai 365'),
  })
  .superRefine((v, ctx) => {
    if (v.principal_nip.trim() && !v.principal_name.trim()) {
      ctx.addIssue({ code: 'custom', path: ['principal_name'], message: 'Nama kepala sekolah wajib diisi jika NIP diisi' })
    }
  })

/** Ganti password dengan kebijakan password kuat. Username/nama akun tidak boleh masuk ke password. */
export function makePasswordSchema(rules: { username: string; fullName?: string }) {
  return z
    .object({
      old: z.string().min(1, 'Password lama wajib diisi'),
      next: z.string().min(1, 'Password baru wajib diisi'),
      confirm: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.next) {
        const issue = passwordIssues(v.next, { forbidden: [rules.username, rules.fullName] })[0]
        if (issue) ctx.addIssue({ code: 'custom', path: ['next'], message: issue })
        else if (v.old && v.next === v.old) {
          ctx.addIssue({ code: 'custom', path: ['next'], message: 'Harus berbeda dari password lama' })
        }
      }
      if (v.confirm !== v.next) {
        ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Konfirmasi tidak sama dengan password baru' })
      }
    })
}