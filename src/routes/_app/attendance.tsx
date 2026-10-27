import { useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm, useStore } from '@tanstack/react-form'
import type { AnyFieldApi } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { Save } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { api } from '~/lib/api'
import {
  NOTES_MIN, STATUS_VALUES, earliestDate, firstMessage, gridSchema, makeFilterSchema, needsNotes,
} from '~/lib/attendance-schema'
import { todayStr } from '~/lib/date'
import { attendanceFormQuery, classesQuery, qk, settingsQuery } from '~/lib/queries'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { isActive, parseClassIds } from '~/lib/types'
import type { AttendanceEntry } from '~/lib/types'
import { DataTable, ErrorAlert, PageSpinner, SelectField, TextField } from '~/components/ui'

export const Route = createFileRoute('/_app/attendance')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === 'string' ? s.date : undefined,
    classId: typeof s.classId === 'string' ? s.classId : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(classesQuery), context.queryClient.ensureQueryData(settingsQuery)]),
  component: AttendancePage,
})

function AttendancePage() {
  const { me } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: classes } = useSuspenseQuery(classesQuery)
  const { data: settings } = useSuspenseQuery(settingsQuery)

  // Aturan dinamis: bergantung peran, kelas yang diampu, dan pengaturan jendela edit
  const restricted = me.role !== 'admin'
  const editWindowDays = Number(settings.edit_window_days) || 0

  const options = useMemo(() => {
    const mine = me.role === 'guru' ? parseClassIds(me.assigned_classes) : null
    return classes.filter((c) => isActive(c.is_active) && (!mine || mine.includes(c.class_id)))
  }, [classes, me.role, me.assigned_classes])

  const rules = useMemo(
    () => ({ classIds: options.map((c) => c.class_id), restricted, editWindowDays }),
    [options, restricted, editWindowDays],
  )
  const filterSchema = useMemo(() => makeFilterSchema(rules), [rules])
  const minDate = earliestDate(rules)

  const form = useForm({
    defaultValues: { date: search.date ?? todayStr(), classId: search.classId ?? '' },
    validators: { onChange: filterSchema, onSubmit: filterSchema },
    onSubmit: ({ value }) => {
      qc.invalidateQueries({ queryKey: qk.attendance })
      navigate({ to: '/attendance', search: { date: value.date, classId: value.classId } })
    },
  })

  // Parameter URL divalidasi dengan aturan yang sama (URL bisa diubah manual)
  const urlCheck = useMemo(
    () => (search.date || search.classId ? filterSchema.safeParse({ date: search.date ?? '', classId: search.classId ?? '' }) : null),
    [filterSchema, search.date, search.classId],
  )

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Input Absensi</h2>

      <div className="card border border-base-300 bg-base-100">
        <form
          noValidate
          className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field name="date">
            {(f) => (
              <TextField
                label="Tanggal"
                field={f}
                type="date"
                max={restricted ? todayStr() : undefined}
                min={minDate}
                hint={restricted && editWindowDays > 0 ? `Maksimal ${editWindowDays} hari ke belakang.` : undefined}
              />
            )}
          </form.Field>
          <form.Field name="classId">
            {(f) => (
              <SelectField label="Kelas" field={f}>
                <option disabled selected value="">-- Pilih Kelas --</option>
                {options.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <button type="submit" className="btn btn-neutral mt-6 w-full">Tampilkan Daftar Siswa</button>
        </form>
      </div>

      {urlCheck && !urlCheck.success ? <ErrorAlert message={urlCheck.error.issues[0]?.message} /> : null}
      {urlCheck?.success ? <AttendanceSection date={urlCheck.data.date} classId={urlCheck.data.classId} /> : null}
    </div>
  )
}

function AttendanceSection({ date, classId }: { date: string; classId: string }) {
  const q = useQuery(attendanceFormQuery(date, classId))
  if (q.isPending) return <PageSpinner />
  if (q.error) return <ErrorAlert message={q.error.message} />
  // dataUpdatedAt: form dimuat ulang dengan data server setelah penyimpanan
  return <AttendanceForm key={`${date}|${classId}|${q.dataUpdatedAt}`} date={date} classId={classId} entries={q.data} />
}

type Row = { student_id: string; nis: string; full_name: string; status: string; notes: string }
const col = columnHelperFor<Row>()

const STATUS_STYLE = {
  Hadir: { tone: 'checkbox-success', text: 'text-success' },
  Sakit: { tone: 'checkbox-warning', text: 'text-warning' },
  Izin: { tone: 'checkbox-info', text: 'text-info' },
  Alpa: { tone: 'checkbox-error', text: 'text-error' },
} as const

/** Kolom keterangan: pesan error muncul setelah disentuh atau setelah percobaan simpan. */
function NotesCell({ field }: { field: AnyFieldApi }) {
  const attempts = useStore(field.form.store, (s) => s.submissionAttempts)
  const msg = field.state.meta.isTouched || attempts > 0 ? firstMessage(field.state.meta.errors) : ''
  return (
    <div className="min-w-48">
      <input
        type="text"
        className={`input input-sm w-full ${msg ? 'input-error' : ''}`}
        value={field.state.value}
        aria-invalid={!!msg}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {msg ? <p role="alert" className="mt-1 text-xs text-error">{msg}</p> : null}
    </div>
  )
}

function AttendanceForm({ date, classId, entries }: { date: string; classId: string; entries: AttendanceEntry[] }) {
  const qc = useQueryClient()

  const rows = useMemo<Row[]>(
    () =>
      entries.map((e) => ({
        student_id: e.student_id,
        nis: e.nis,
        full_name: e.full_name,
        status: e.status === 'Belum Ada' ? '' : e.status,
        notes: e.notes,
      })),
    [entries],
  )

  const save = useMutation({
    mutationFn: (payload: { student_id: string; status: string; notes: string }[]) => api.submitAttendance(date, classId, payload),
    onSuccess: (r) => {
      toast.success(r.message || 'Data berhasil disimpan')
      qc.invalidateQueries({ queryKey: qk.attendance })
      qc.invalidateQueries({ queryKey: qk.dashboard })
      qc.invalidateQueries({ queryKey: qk.report })
    },
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { rows },
    validators: { onChange: gridSchema, onSubmit: gridSchema },
    onSubmitInvalid: () => toast.error('Periksa kembali isian yang ditandai merah.'),
    onSubmit: async ({ value }) => {
      const payload = value.rows.filter((r) => r.status).map(({ student_id, status, notes }) => ({ student_id, status, notes: notes.trim() }))
      if (payload.length === 0) {
        toast.error('Tidak ada data absensi untuk disimpan')
        return
      }
      await save.mutateAsync(payload).catch(() => {})
    },
  })

  const markAll = (status: string) => {
    rows.forEach((_, i) => form.setFieldValue(`rows[${i}].status` as const, status))
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.display({ id: 'no', header: 'No', cell: ({ row }) => row.index + 1 }),
        col.accessor('nis', { header: 'NIS', enableSorting: false }),
        col.accessor('full_name', { header: 'Nama Siswa', enableSorting: false, cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
        ...STATUS_VALUES.map((s) =>
          col.display({
            id: s,
            header: () => (
              <button type="button" title={`Tandai semua ${s}`} onClick={() => markAll(s)} className={`btn btn-ghost btn-xs ${STATUS_STYLE[s].text}`}>
                {s}
              </button>
            ),
            cell: ({ row }) => (
              <form.Field name={`rows[${row.index}].status` as const}>
                {(f) => (
                  <div className="text-center">
                    <input
                      type="checkbox"
                      aria-label={s}
                      className={`checkbox checkbox-sm ${STATUS_STYLE[s].tone}`}
                      checked={f.state.value === s}
                      onChange={(e) => f.handleChange(e.target.checked ? s : '')}
                    />
                  </div>
                )}
              </form.Field>
            ),
          }),
        ),
        col.display({
          id: 'notes',
          header: 'Keterangan',
          cell: ({ row }) => (
            <form.Field name={`rows[${row.index}].notes` as const}>{(f) => <NotesCell field={f} />}</form.Field>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  )

  const table = useTable({ features, columns, data: rows, initialState: { pagination: { pageIndex: 0, pageSize: 1000 } } })

  return (
    <form
      noValidate
      className="card overflow-hidden border border-base-300 bg-base-100"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 p-4">
        <h3 className="font-semibold">Daftar Siswa</h3>
        <button type="button" onClick={() => markAll('Hadir')} className="btn btn-ghost btn-sm text-primary">
          Tandai Semua Hadir
        </button>
      </div>

      <DataTable table={table} emptyText="Tidak ada siswa terdaftar di kelas ini." />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 p-4">
        {/* Ringkasan dinamis dari nilai form */}
        <form.Subscribe selector={(s) => s.values.rows}>
          {(vals) => {
            const filled = vals.filter((r) => r.status).length
            const missing = vals.filter((r) => needsNotes(r.status) && r.notes.trim().length < NOTES_MIN).length
            return (
              <p className="text-sm text-base-content/70">
                Terisi {filled} dari {vals.length} siswa
                {missing > 0 ? <span className="ml-2 text-error">· {missing} perlu keterangan</span> : null}
              </p>
            )
          }}
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button type="submit" className="btn btn-primary" disabled={busy || rows.length === 0}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : <Save className="size-4" />}
              Simpan Data Absensi
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}