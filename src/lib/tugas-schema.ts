import { z } from 'zod'
import { isRealDate } from './date'

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6
export const ESSAY_MAX = 5000
export const letter = (i: number) => String.fromCharCode(65 + i)

/** 'yyyy-MM-ddTHH:mm' menurut waktu lokal browser (untuk membandingkan dengan input datetime-local). */
export function nowLocalInput() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ---------- tugas ---------- */

export interface AssignmentRules {
  /** Kelas yang boleh dipilih akun ini */
  classIds: string[]
  /** Jumlah soal saat ini (tugas tanpa soal tidak boleh dipublikasikan) */
  questionCount: number
  isNew: boolean
}

export function makeAssignmentSchema(r: AssignmentRules) {
  return z
    .object({
      title: z.string().trim().min(1, 'Judul wajib diisi').max(150, 'Maksimal 150 karakter'),
      description: z.string().trim().max(1000, 'Maksimal 1000 karakter'),
      class_id: z.string().min(1, 'Pilih kelas').refine((id) => !id || r.classIds.includes(id), 'Kelas tidak tersedia untuk akun Anda'),
      due_at: z
        .string()
        .refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && isRealDate(v.slice(0, 10))), 'Tenggat tidak valid'),
      duration_minutes: z
        .string()
        .trim()
        .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 600), 'Isi 0 sampai 600 menit'),
      is_published: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.is_published && r.questionCount === 0) {
        ctx.addIssue({ code: 'custom', path: ['is_published'], message: 'Tambahkan minimal satu soal sebelum mempublikasikan' })
      }
      // Tugas baru: tenggat harus di masa depan. Saat edit, tenggat lampau boleh dipertahankan.
      if (r.isNew && v.due_at && v.due_at <= nowLocalInput()) {
        ctx.addIssue({ code: 'custom', path: ['due_at'], message: 'Tenggat harus di waktu yang akan datang' })
      }
    })
}

/* ---------- soal: aturan bergantung tipe ---------- */

export function makeQuestionSchema() {
  return z
    .object({
      type: z.string().refine((v) => v === 'pilihan_ganda' || v === 'esai', 'Pilih tipe soal'),
      text: z.string().trim().min(1, 'Pertanyaan wajib diisi').max(2000, 'Maksimal 2000 karakter'),
      options: z.array(z.string()),
      correct_index: z.string(),
      points: z
        .string()
        .trim()
        .min(1, 'Poin wajib diisi')
        .regex(/^\d+$/, 'Poin berupa bilangan bulat')
        .refine((v) => !/^\d+$/.test(v) || (Number(v) >= 1 && Number(v) <= 100), 'Poin 1 sampai 100'),
    })
    .superRefine((v, ctx) => {
      if (v.type !== 'pilihan_ganda') return // esai: tidak ada pilihan / kunci

      const opts = v.options.map((o) => o.trim())
      if (opts.length < MIN_OPTIONS) ctx.addIssue({ code: 'custom', path: ['options'], message: `Minimal ${MIN_OPTIONS} pilihan jawaban` })
      if (opts.length > MAX_OPTIONS) ctx.addIssue({ code: 'custom', path: ['options'], message: `Maksimal ${MAX_OPTIONS} pilihan jawaban` })

      const seen = new Map<string, number>()
      opts.forEach((o, i) => {
        if (!o) ctx.addIssue({ code: 'custom', path: ['options', i], message: 'Pilihan wajib diisi' })
        else if (o.length > 300) ctx.addIssue({ code: 'custom', path: ['options', i], message: 'Maksimal 300 karakter' })
        else {
          const k = o.toLowerCase()
          const first = seen.get(k)
          if (first !== undefined) ctx.addIssue({ code: 'custom', path: ['options', i], message: `Sama dengan pilihan ${letter(first)}` })
          else seen.set(k, i)
        }
      })

      if (v.correct_index === '') {
        ctx.addIssue({ code: 'custom', path: ['correct_index'], message: 'Pilih satu jawaban yang benar' })
      } else {
        const idx = Number(v.correct_index)
        if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) {
          ctx.addIssue({ code: 'custom', path: ['correct_index'], message: 'Jawaban benar tidak valid' })
        }
      }
    })
}

/* ---------- penilaian esai: batas nilai mengikuti poin tiap soal ---------- */

export function makeGradeSchema(essays: { question_id: string; points: number }[]) {
  return z
    .object({
      grades: z.array(
        z.object({
          question_id: z.string(),
          score: z.string(),
          feedback: z.string().max(500, 'Maksimal 500 karakter'),
        }),
      ),
    })
    .superRefine((v, ctx) => {
      v.grades.forEach((g, i) => {
        const max = essays.find((e) => e.question_id === g.question_id)?.points ?? 0
        const s = g.score.trim().replace(',', '.')
        if (s === '') ctx.addIssue({ code: 'custom', path: ['grades', i, 'score'], message: 'Nilai wajib diisi' })
        else if (!/^\d+(\.\d{1,2})?$/.test(s)) ctx.addIssue({ code: 'custom', path: ['grades', i, 'score'], message: 'Nilai harus berupa angka' })
        else if (Number(s) > max) ctx.addIssue({ code: 'custom', path: ['grades', i, 'score'], message: `Maksimal ${max}` })
      })
    })
}

/* ---------- pengerjaan siswa ---------- */

export function makeTakeSchema(questions: { question_id: string; type: string; options: string[] }[]) {
  return z
    .object({ answers: z.array(z.object({ question_id: z.string(), answer: z.string() })) })
    .superRefine((v, ctx) => {
      v.answers.forEach((a, i) => {
        const q = questions.find((x) => x.question_id === a.question_id)
        if (!q) return
        if (q.type === 'esai') {
          if (a.answer.length > ESSAY_MAX) {
            ctx.addIssue({ code: 'custom', path: ['answers', i, 'answer'], message: `Maksimal ${ESSAY_MAX} karakter (sekarang ${a.answer.length})` })
          }
        } else if (a.answer !== '' && !(/^\d+$/.test(a.answer) && Number(a.answer) < q.options.length)) {
          ctx.addIssue({ code: 'custom', path: ['answers', i, 'answer'], message: 'Pilihan tidak valid' })
        }
      })
    })
}