import { useMemo } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { ArrowLeft, Check, X } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { toast } from '~/lib/toast'
import { tugas } from '~/lib/tugas-api'
import { reviewQuery, tk } from '~/lib/tugas-queries'
import { letter, makeGradeSchema } from '~/lib/tugas-schema'
import { ErrorAlert, TextField, TextAreaField } from '~/components/ui'

export const Route = createFileRoute('/_app/assignments/$assignmentId/review/$submissionId')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  loader: ({ context, params }) => context.queryClient.query(reviewQuery(params.submissionId)),
  component: ReviewPage,
})

function ReviewPage() {
  const { assignmentId, submissionId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data } = useSuspenseQuery(reviewQuery(submissionId))
  const { submission, student, assignment, answers } = data

  const essays = useMemo(() => answers.filter((a) => a.question.type === 'esai'), [answers])
  const essayIndex = useMemo(() => new Map(essays.map((a, i) => [a.question.question_id, i])), [essays])

  // Batas nilai tiap esai mengikuti poin soalnya
  const schema = useMemo(
    () => makeGradeSchema(essays.map((a) => ({ question_id: a.question.question_id, points: a.question.points }))),
    [essays],
  )

  const save = useMutation({
    mutationFn: (grades: { question_id: string; score: string; feedback: string }[]) => tugas.grade(submissionId, grades),
    onSuccess: (r) => {
      toast.success(r.message)
      void qc.invalidateQueries({ queryKey: tk.review(submissionId) })
      void qc.invalidateQueries({ queryKey: tk.subs(assignmentId) })
      void qc.invalidateQueries({ queryKey: tk.list })
      void navigate({ to: '/assignments/$assignmentId/submissions', params: { assignmentId } })
    },
  })

  const form = useForm({
    defaultValues: {
      grades: essays.map((a) => ({
        question_id: a.question.question_id,
        score: a.score === '' ? '' : String(a.score),
        feedback: a.feedback,
      })),
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmitInvalid: () => toast.error('Lengkapi nilai semua soal esai.'),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync(value.grades.map((g) => ({ question_id: g.question_id, score: g.score.trim().replace(',', '.'), feedback: g.feedback.trim() })))
        .catch(() => {})
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <Link to="/assignments/$assignmentId/submissions" params={{ assignmentId }} className="btn btn-ghost btn-xs mb-1 -ml-2">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
        <h2 className="text-2xl font-bold">{assignment.title}</h2>
        <p className="text-sm text-base-content/60">
          {student.full_name} (NIS {student.nis}) - Kelas {assignment.class_name} - dikumpulkan{' '}
          {new Date(submission.submitted_at).toLocaleString('id-ID')}
        </p>
      </div>

      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        {answers.map((a, n) => {
          const q = a.question
          if (q.type === 'pilihan_ganda') {
            const chosen = a.answer === '' ? -1 : Number(a.answer)
            return (
              <div key={q.question_id} className="card border border-base-300 bg-base-100">
                <div className="card-body gap-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-line font-medium">{n + 1}. {q.text}</p>
                    <span className={`badge badge-soft shrink-0 ${a.is_correct ? 'badge-success' : 'badge-error'}`}>
                      {a.is_correct ? <Check className="mr-1 size-3" /> : <X className="mr-1 size-3" />}
                      {a.score === '' ? 0 : a.score}/{q.points}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {q.options.map((o, i) => (
                      <li key={`${q.question_id}-${o}`} className={`flex items-center gap-2 ${i === Number(q.correct_index) ? 'font-semibold text-success' : ''}`}>
                        <span className="w-5">{letter(i)}.</span>
                        <span>{o}</span>
                        {i === chosen ? <span className="badge badge-ghost badge-sm">jawaban siswa</span> : null}
                        {i === Number(q.correct_index) ? <span className="badge badge-success badge-soft badge-sm">kunci</span> : null}
                      </li>
                    ))}
                  </ul>
                  {chosen === -1 ? <p className="text-xs text-base-content/60">Siswa tidak menjawab.</p> : null}
                </div>
              </div>
            )
          }

          const k = essayIndex.get(q.question_id) ?? 0
          return (
            <div key={q.question_id} className="card border border-warning/40 bg-base-100">
              <div className="card-body gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-line font-medium">{n + 1}. {q.text}</p>
                  <span className="badge badge-warning badge-soft shrink-0">Esai - maks {q.points}</span>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-base-content/60">Jawaban siswa</p>
                  <div className="whitespace-pre-wrap rounded-box bg-base-200 p-3 text-sm">
                    {a.answer.trim() ? a.answer : <span className="text-base-content/50">(tidak dijawab)</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <form.Field name={`grades[${k}].score` as const}>
                    {(f) => <TextField label={`Nilai (0-${q.points})`} field={f} inputMode="decimal" />}
                  </form.Field>
                  <div className="sm:col-span-3">
                    <form.Field name={`grades[${k}].feedback` as const}>
                      {(f) => <TextAreaField label="Komentar untuk siswa (opsional)" field={f} rows={2} />}
                    </form.Field>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        <ErrorAlert message={save.error?.message} />

        <div className="card sticky bottom-0 border border-base-300 bg-base-100 shadow-lg">
          <div className="card-body flex-row flex-wrap items-center justify-between gap-3 p-4">
            <form.Subscribe selector={(s) => s.values.grades}>
              {(grades) => {
                const manual = grades.reduce((t, g) => {
                  const v = Number(g.score.trim().replace(',', '.'))
                  return t + (g.score.trim() !== '' && Number.isFinite(v) ? v : 0)
                }, 0)
                const total = submission.auto_score + manual
                return (
                  <p className="text-sm">
                    Pilihan ganda <b>{submission.auto_score}</b> + esai <b>{Math.round(manual * 100) / 100}</b> = <b>{Math.round(total * 100) / 100}</b> / {submission.max_score}
                    <span className="ml-1 text-base-content/60">
                      ({submission.max_score > 0 ? Math.round((total / submission.max_score) * 1000) / 10 : 0})
                    </span>
                  </p>
                )
              }}
            </form.Subscribe>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(busy) => (
                <button type="submit" className="btn btn-primary" disabled={busy || essays.length === 0}>
                  {busy ? <span className="loading loading-spinner loading-sm" /> : null}
                  {submission.status === 'diserahkan' ? 'Simpan & Tampilkan Nilai ke Siswa' : 'Perbarui Nilai'}
                </button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </form>
    </div>
  )
}