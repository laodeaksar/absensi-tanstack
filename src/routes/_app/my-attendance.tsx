import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { allowRoles } from '~/lib/auth'
import { monthStart, todayStr } from '~/lib/date'
import { myAttendanceQuery } from '~/lib/queries'
import { makeMyRangeSchema } from '~/lib/report-schema'
import { columnHelperFor, features } from '~/lib/table'
import type { MyAttendance } from '~/lib/types'
import { DataTable, ErrorAlert, PageSpinner, Pager, StatusBadge, TextField } from '~/components/ui'

export const Route = createFileRoute('/_app/my-attendance')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['siswa']),
  component: MyAttendancePage,
})

type Rec = MyAttendance['records'][number]
const col = columnHelperFor<Rec>()
const columns = col.columns([
  col.accessor('date', { header: 'Tanggal' }),
  col.accessor('status', { header: 'Status', cell: (i) => <StatusBadge status={i.getValue()} /> }),
  col.accessor('notes', { header: 'Keterangan', enableSorting: false, cell: (i) => i.getValue() || '-' }),
])

function MyAttendancePage() {
  const [range, setRange] = useState({ startDate: monthStart(), endDate: todayStr() })
  const q = useQuery(myAttendanceQuery(range))
  const data = q.data?.records ?? []
  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 15 } } })

  // Aturan: tanggal wajib, awal <= akhir, akhir tidak di masa depan, rentang dibatasi
  const schema = useMemo(() => makeMyRangeSchema(), [])

  const form = useForm({
    defaultValues: range,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => setRange(value),
  })

  const p = q.data?.profile
  const s = q.data?.summary

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Kehadiran Saya</h2>
        {p ? <p className="text-sm text-base-content/60">{p.full_name} - NIS {p.nis || '-'} - Kelas {p.class_name || '-'}</p> : null}
      </div>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body flex-row items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-base-content/60">Status hari ini</p>
            {q.data?.today?.notes ? <p className="mt-1 text-xs text-base-content/60">{q.data.today.notes}</p> : null}
          </div>
          <StatusBadge status={q.data ? (q.data.today ? q.data.today.status : 'Belum diisi') : '...'} />
        </div>
      </div>

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
          <form.Field name="startDate">{(f) => <TextField label="Dari Tanggal" field={f} type="date" max={todayStr()} />}</form.Field>
          <form.Field name="endDate">{(f) => <TextField label="Sampai Tanggal" field={f} type="date" max={todayStr()} />}</form.Field>
          <button type="submit" className="btn btn-primary mt-6 w-full">Tampilkan</button>
        </form>
      </div>

      {q.isPending ? <PageSpinner /> : null}
      <ErrorAlert message={q.error?.message} />

      {s ? (
        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
          <div className="stat"><div className="stat-title">Hadir</div><div className="stat-value text-2xl text-success">{s.hadir}</div></div>
          <div className="stat"><div className="stat-title">Sakit</div><div className="stat-value text-2xl text-warning">{s.sakit}</div></div>
          <div className="stat"><div className="stat-title">Izin</div><div className="stat-value text-2xl text-info">{s.izin}</div></div>
          <div className="stat"><div className="stat-title">Alpa</div><div className="stat-value text-2xl text-error">{s.alpa}</div></div>
          <div className="stat"><div className="stat-title">Kehadiran</div><div className="stat-value text-2xl text-primary">{s.persentase}%</div></div>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable table={table} emptyText="Belum ada data absensi pada periode ini." />
        <Pager table={table} />
      </div>
    </div>
  )
}