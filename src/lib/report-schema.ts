import { z } from 'zod'
import { isRealDate, todayStr } from './date'
import { rangeIssue } from './validation'

const optionalDate = (label: string) => z.string().refine((v) => v === '' || isRealDate(v), `${label} tidak valid`)

/** Filter laporan: tanggal opsional, kelas harus yang tersedia untuk akun, rentang dibatasi. */
export function makeReportFilterSchema(rules: { classIds: string[] }) {
  return z
    .object({
      startDate: optionalDate('Tanggal awal'),
      endDate: optionalDate('Tanggal akhir'),
      classId: z.string().refine((id) => !id || rules.classIds.includes(id), 'Kelas tidak tersedia untuk akun Anda'),
    })
    .superRefine((v, ctx) => {
      const msg = rangeIssue(v.startDate, v.endDate)
      if (msg) ctx.addIssue({ code: 'custom', path: ['endDate'], message: msg })
    })
}

/** Rentang kehadiran siswa: wajib, tidak boleh melewati hari ini. */
export function makeMyRangeSchema() {
  const today = todayStr()
  return z
    .object({
      startDate: z.string().min(1, 'Tanggal awal wajib diisi').refine((v) => !v || isRealDate(v), 'Tanggal awal tidak valid'),
      endDate: z
        .string()
        .min(1, 'Tanggal akhir wajib diisi')
        .refine((v) => !v || isRealDate(v), 'Tanggal akhir tidak valid')
        .refine((v) => !isRealDate(v) || v <= today, 'Tanggal akhir tidak boleh di masa depan'),
    })
    .superRefine((v, ctx) => {
      const msg = rangeIssue(v.startDate, v.endDate)
      if (msg) ctx.addIssue({ code: 'custom', path: ['endDate'], message: msg })
    })
}