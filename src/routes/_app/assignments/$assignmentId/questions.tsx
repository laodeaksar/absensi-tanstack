import { useMemo, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft, Lock, Plus, Trash2 } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { tugas } from '~/lib/tugas-api'
import { assignmentDetailQuery, tk } from '~/lib/tugas-queries'
import { MAX_OPTIONS, MIN_OPTIONS, letter, makeQuestionSchema } from '~/lib/tugas-schema'
import type { Question, QuestionInput } from '~/lib/tugas-types'
import { firstMessage } from '~/lib/validation'
import { DataTable, ErrorAlert, Modal, SelectField, TextField, TextAreaField, useConfirm } from '~/components/ui'

export const Route = createFileRoute('/_app/assignments/$assignmentId/questions')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(assignmentDetailQuery(params.assignmentId)),
  component: QuestionsPage,
})

const col = columnHelperFor<Question>()

function QuestionsPage() {
  const { assignmentId } = Route.useParams()
  const qc = useQueryClient()
  const { data } = useSuspenseQuery(assignmentDetailQuery(assignmentId))
  const { assignment, questions, locked, max_score } = data
  const [modal, setModal] = useState<{ open: boolean; question: Question | null }>({ open: false, question: null })
  const { confirm, dialog } = useConfirm()

  const refresh = () => {
    qc.invalidateQueries({ queryKey: tk.detail(assignmentId) })
    qc.invalidateQueries({ queryKey: tk.list })
  }

  const remove = useMutation({
    mutationFn: (id: string) => tugas.deleteQuestion(id),
    onSuccess: (r) => {
      toast.success(r.message)
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })

  const actions = useRef({ edit: (_q: Question) => {}, remove: (_q: Question) => {}, locked })
  actions.current = {
    locked,
    edit: (q) => setModal({ open: true, question: q }),
    remove: async (q) => {
      if (await confirm('Hapus soal ini?')) remove.mutate(q.question_id)
    },
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.display({ id: 'no', header: 'No', cell: ({ row }) => row.index + 1 }),
        col.display({
          id: 'q',
          header: 'Soal',
          cell: ({ row }) => {
            const q = row.original
            return (
              <div className="min-w-60 max-w-xl">
                <p className="whitespace-pre-line font-medium">{q.text}</p>
                {q.type === 'pilihan_ganda' ? (
                  <ol className="mt-1 list-[upper-alpha] pl-5 text-sm">
                    {q.options.map((o, i) => (
                      <li key={i} className={i === Number(q.correct_index) ? 'font-semibold text-success' : ''}>{o}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-xs text-base-content/60">Dinilai manual oleh guru/admin.</p>
                )}
              </div>
            )
          },
        }),
        col.display({
          id: 'type',
          header: 'Tipe',
          cell: ({ row }) => (
            <span className={`badge badge-soft badge-sm ${row.original.type === 'esai' ? 'badge-warning' : 'badge-info'}`}>
              {row.original.type === 'esai' ? 'Esai' : 'Pilihan ganda'}
            </span>
          ),
        }),
        col.accessor('points', { header: 'Poin', enableSorting: false }),
        col.display({
          id: 'actions',
          header: 'Aksi',
          cell: ({ row }) => (
            <div className="whitespace-nowrap">
              <button type="button" className="btn btn-ghost btn-xs text-primary" disabled={actions.current.locked} onClick={() => actions.current.edit(row.original)}>Edit</button>
              <button type="button" className="btn btn-ghost btn-xs text-error" disabled={actions.current.locked} onClick={() => actions.current.remove(row.original)}>Hapus</button>
            </div>
          ),
        }),
      ]),
    [],
  )

  const table = useTable({ features, columns, data: questions, initialState: { pagination: { pageIndex: 0, pageSize: 1000 } } })

  return (
    <div className="space-y-4">
      <div>
        <Link to="/assignments" className="btn btn-ghost btn-xs mb-1 -ml-2"><ArrowLeft className="size-4" /> Kembali</Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold">{assignment.title}</h2>
            <p className="text-sm text-base-content/60">
              Kelas {assignment.class_name} - {questions.length} soal - total {max_score} poin
              {assignment.is_published === true || assignment.is_published === 'TRUE' ? ' - Terbit' : ' - Draft'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/assignments/$assignmentId/submissions" params={{ assignmentId }} className="btn btn-outline btn-sm">Pengumpulan</Link>
            <button type="button" className="btn btn-primary btn-sm" disabled={locked} onClick={() => setModal({ open: true, question: null })}>
              <Plus className="size-4" /> Tambah Soal
            </button>
          </div>
        </div>
      </div>

      {locked ? (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          <Lock className="size-4 shrink-0" />
          <span>Sudah ada siswa yang mengerjakan, jadi soal terkunci (tidak bisa ditambah, diubah, atau dihapus).</span>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable table={table} emptyText="Belum ada soal. Klik Tambah Soal." />
      </div>

      <Modal open={modal.open} onClose={() => setModal((m) => ({ ...m, open: false }))} title={modal.question ? 'Edit Soal' : 'Tambah Soal'}>
        <QuestionForm
          assignmentId={assignmentId}
          question={modal.question}
          onDone={() => {
            setModal({ open: false, question: null })
            refresh()
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
      {dialog}
    </div>
  )
}

function QuestionForm({ assignmentId, question, onDone, onCancel }: { assignmentId: string; question: Question | null; onDone: () => void; onCancel: () => void }) {
  const schema = useMemo(() => makeQuestionSchema(), [])

  const save = useMutation({
    mutationFn: (v: QuestionInput) => tugas.saveQuestion(v),
    onSuccess: (r) => {
      toast.success(r.message)
      onDone()
    },
  })

  const form = useForm({
    defaultValues: {
      type: question?.type ?? 'pilihan_ganda',
      text: question?.text ?? '',
      options: question && question.options.length > 0 ? question.options : ['', '', '', ''],
      correct_index: question && question.correct_index !== '' ? String(question.correct_index) : '',
      points: String(question?.points ?? 10),
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmitInvalid: () => toast.error('Periksa kembali isian yang ditandai merah.'),
    onSubmit: async ({ value }) => {
      const isMcq = value.type === 'pilihan_ganda'
      await save
        .mutateAsync({
          question_id: question?.question_id ?? '',
          assignment_id: assignmentId,
          type: value.type as QuestionInput['type'],
          text: value.text.trim(),
          options: isMcq ? value.options.map((o) => o.trim()) : [],
          correct_index: isMcq ? Number(value.correct_index) : '',
          points: Number(value.points),
        })
        .catch(() => {})
    },
  })

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <form.Field name="type">
            {(f) => (
              <SelectField label="Tipe Soal" field={f}>
                <option value="pilihan_ganda">Pilihan ganda</option>
                <option value="esai">Esai</option>
              </SelectField>
            )}
          </form.Field>
        </div>
        <form.Field name="points">{(f) => <TextField label="Poin" field={f} inputMode="numeric" />}</form.Field>
      </div>

      <form.Field name="text">{(f) => <TextAreaField label="Pertanyaan" field={f} rows={4} maxLength={2100} />}</form.Field>

      {/* Bagian pilihan hanya untuk pilihan ganda */}
      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type === 'pilihan_ganda' ? (
            <form.Field name="options" mode="array">
              {(opts) => {
                const count = opts.state.value.length
                const listMsg = opts.state.meta.isTouched ? firstMessage(opts.state.meta.errors) : ''
                const removeAt = (i: number) => {
                  opts.removeValue(i)
                  const ci = form.getFieldValue('correct_index')
                  if (ci !== '') {
                    const n = Number(ci)
                    if (n === i) form.setFieldValue('correct_index', '')
                    else if (n > i) form.setFieldValue('correct_index', String(n - 1))
                  }
                }
                return (
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">Pilihan Jawaban (pilih yang benar)</legend>
                    <div className="space-y-1">
                      {opts.state.value.map((_, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <form.Field name="correct_index">
                            {(cf) => (
                              <input
                                type="radio"
                                name="correct"
                                className="radio radio-primary radio-sm mt-9"
                                aria-label={`Jawaban benar: pilihan ${letter(i)}`}
                                checked={cf.state.value === String(i)}
                                onChange={() => cf.handleChange(String(i))}
                              />
                            )}
                          </form.Field>
                          <div className="flex-1">
                            <form.Field name={`options[${i}]` as const}>
                              {(f) => <TextField label={`Pilihan ${letter(i)}`} field={f} maxLength={310} />}
                            </form.Field>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm mt-8"
                            disabled={count <= MIN_OPTIONS}
                            onClick={() => removeAt(i)}
                            aria-label={`Hapus pilihan ${letter(i)}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm w-fit text-primary" disabled={count >= MAX_OPTIONS} onClick={() => opts.pushValue('')}>
                      <Plus className="size-4" /> Tambah pilihan
                    </button>
                    {listMsg ? <p role="alert" className="text-xs text-error">{listMsg}</p> : null}
                    <form.Field name="correct_index">
                      {(cf) => {
                        const m = cf.state.meta.isTouched ? firstMessage(cf.state.meta.errors) : ''
                        return m ? <p role="alert" className="text-xs text-error">{m}</p> : null
                      }}
                    </form.Field>
                  </fieldset>
                )
              }}
            </form.Field>
          ) : (
            <p className="rounded-box bg-base-200 p-3 text-sm text-base-content/70">
              Soal esai dijawab dengan teks bebas dan dinilai manual oleh guru atau admin. Nilai baru tampil ke siswa setelah dinilai.
            </p>
          )
        }
      </form.Subscribe>

      <ErrorAlert message={save.error?.message} />

      <div className="modal-action">
        <button type="button" className="btn" onClick={onCancel}>Batal</button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : null}
              Simpan
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}