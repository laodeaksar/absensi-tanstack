import { useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm, revalidateLogic } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { Save } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { api } from '~/lib/api'
import { todayStr } from '~/lib/date'
import { attendanceFormQuery, classesQuery, qk } from '~/lib/queries'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { isActive, parseClassIds } from '~/lib/types'
import type { AttendanceEntry } from '~/lib/types'
import { DataTable, ErrorAlert, PageSpinner, SelectField, TextField, vString } from '~/components/ui'
import { z } from "zod"

export const Route = createFileRoute('/_app/attendance')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === 'string' ? s.date : undefined,
    classId: typeof s.classId === 'string' ? s.classId : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  component: AttendancePage,
})

function AttendancePage() {
  const { me } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: classes } = useSuspenseQuery(classesQuery)

  // Guru hanya melihat kelas yang diampunya
  const mine = me.role === 'guru' ? parseClassIds(me.assigned_classes) : null
  const options = classes.filter((c) => isActive(c.is_active) && (!mine || mine.includes(c.class_id)))

  const form = useForm({
    defaultValues: { 
      date: search.date ?? todayStr(), 
      classId: search.classId ?? '' 
    },
    onSubmit: ({ value }) => {
      qc.invalidateQueries({ queryKey: qk.attendance })
      navigate({ 
        to: '/attendance', 
        search: { 
          date: value.date, 
          classId: value.classId 
        } 
      })
    },
  })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Input Absensi</h2>

      <div className="card border border-base-300 bg-base-100">
        <form
          noValidate
          className="card-body grid grid-cols-1 items-end gap-4 p-5 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field name="date" validators={vString(({ value }) => (!value ? 'Tanggal wajib diisi' : undefined))}>
            {(f) => <TextField label="Tanggal" field={f} type="date" />}
          </form.Field>
          <form.Field name="classId" validators={vString(({ value }) => (!value ? 'Pilih kelas' : undefined))}>
            {(f) => (
              <SelectField label="Kelas" field={f}>
                <option disabled selected value="">-- Pilih Kelas --</option>
                {options.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <button type="submit" className="btn btn-neutral w-full">Tampilkan Daftar Siswa</button>
        </form>
      </div>

      {search.date && search.classId ? <AttendanceSection date={search.date} classId={search.classId} /> : null}
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

const STATUSES = [
  { value: 'Hadir', tone: 'checkbox-success', text: 'text-success' },
  { value: 'Sakit', tone: 'checkbox-warning', text: 'text-warning' },
  { value: 'Izin', tone: 'checkbox-info', text: 'text-info' },
  { value: 'Alpa', tone: 'checkbox-error', text: 'text-error' },
] as const

function AttendanceForm({ 
  date, 
  classId, 
  entries 
}: { 
  date: string; 
  classId: string; 
  entries: AttendanceEntry[] 
}) {
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
    onSubmit: async ({ value }) => {
      const payload = value.rows.filter((r) => r.status).map(({ student_id, status, notes }) => ({ student_id, status, notes }))
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
        ...STATUSES.map((s) =>
          col.display({
            id: s.value,
            header: () => (
              <button type="button" title={`Tandai semua ${s.value}`} onClick={() => markAll(s.value)} className={`btn btn-ghost btn-xs ${s.text}`}>
                {s.value}
              </button>
            ),
            cell: ({ row }) => (
              <form.Field name={`rows[${row.index}].status` as const}>
                {(f) => (
                  <div className="text-center">
                    <input
                      type="checkbox"
                      aria-label={s.value}
                      className={`checkbox checkbox-sm ${s.tone}`}
                      checked={f.state.value === s.value}
                      onChange={(e) => f.handleChange(e.target.checked ? s.value : '')}
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
            <form.Field name={`rows[${row.index}].notes` as const}>
              {(f) => (
                <input
                  type="text"
                  className="input input-sm w-full"
                  value={f.state.value}
                  onBlur={f.handleBlur}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  )

  const table = useTable({ 
    features, 
    columns, 
    data: rows, 
    initialState: { 
      pagination: { 
        pageIndex: 0, 
        pageSize: 1000 
      } 
    } 
  })

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

      <div className="flex items-center justify-end gap-3 border-t border-base-300 p-4">
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