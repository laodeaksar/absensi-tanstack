import { useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { Printer } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { classesQuery, reportQuery, settingsQuery } from '~/lib/queries'
import { makeReportFilterSchema } from '~/lib/report-schema'
import { columnHelperFor, features } from '~/lib/table'
import { isActive, parseClassIds } from '~/lib/types'
import type { ReportRow } from '~/lib/types'
import { DataTable, ErrorAlert, PageSpinner, Pager, SelectField, StatusBadge, TextField } from '~/components/ui'

export const Route = createFileRoute('/_app/reports')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  validateSearch: (s: Record<string, unknown>) => ({
    startDate: typeof s.startDate === 'string' ? s.startDate : undefined,
    endDate: typeof s.endDate === 'string' ? s.endDate : undefined,
    classId: typeof s.classId === 'string' ? s.classId : undefined,
    go: s.go === true || s.go === 'true' ? true : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.query(classesQuery), context.queryClient.query(settingsQuery)]),
  component: ReportsPage,
})

const col = columnHelperFor<ReportRow>()

const columns = col.columns([
  col.accessor('date', { header: 'Tanggal' }),
  col.accessor('nis', { header: 'NIS' }),
  col.accessor('student_name', { header: 'Nama Siswa', cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
  col.accessor('class_name', { header: 'Kelas' }),
  col.accessor('status', { header: 'Status', cell: (i) => <StatusBadge status={i.getValue()} /> }),
  col.accessor('notes', { header: 'Keterangan', enableSorting: false }),
])

function ReportsPage() {
  const { me } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { data: classes } = useSuspenseQuery(classesQuery)
  const { data: settings } = useSuspenseQuery(settingsQuery)

  // Aturan dinamis: kelas yang tersedia bergantung peran (guru hanya kelasnya)
  const options = useMemo(() => {
    const mine = me.role === 'guru' ? parseClassIds(me.assigned_classes) : null
    return classes.filter((c) => isActive(c.is_active) && (!mine || mine.includes(c.class_id)))
  }, [classes, me.role, me.assigned_classes])

  const schema = useMemo(() => makeReportFilterSchema({ classIds: options.map((c) => c.class_id) }), [options])

  // Parameter URL divalidasi dengan aturan yang sama sebelum data diminta
  const urlCheck = useMemo(
    () =>
      search.go
        ? schema.safeParse({ startDate: search.startDate ?? '', endDate: search.endDate ?? '', classId: search.classId ?? '' })
        : null,
    [schema, search.go, search.startDate, search.endDate, search.classId],
  )

  const filters = { startDate: search.startDate, endDate: search.endDate, classId: search.classId }
  const report = useQuery({ ...reportQuery(filters), enabled: !!urlCheck?.success })
  const data = report.data ?? []

  const form = useForm({
    defaultValues: { startDate: search.startDate ?? '', endDate: search.endDate ?? '', classId: search.classId ?? '' },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => {
      navigate({
        to: '/reports',
        search: {
          startDate: value.startDate || undefined,
          endDate: value.endDate || undefined,
          classId: value.classId || undefined,
          go: true,
        },
      })
    },
  })

  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 25 } } })

  const stats = useMemo(() => {
    const s = { hadir: 0, sakit: 0, izin: 0, alpa: 0 }
    for (const r of data) {
      if (r.status === 'Hadir') s.hadir++
      else if (r.status === 'Sakit') s.sakit++
      else if (r.status === 'Izin') s.izin++
      else s.alpa++
    }
    return s
  }, [data])
  const pct = data.length ? `${((stats.hadir / data.length) * 100).toFixed(1)}%` : '0%'

  // Cetak semua baris: perbesar ukuran halaman sementara, kembalikan setelah dialog cetak
  const print = () => {
    const prev = table.state.pagination.pageSize
    table.setPageSize(Math.max(data.length, 1))
    const restore = () => {
      table.setPageSize(prev)
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    setTimeout(() => window.print(), 50)
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <h2 className="text-2xl font-bold">Laporan Absensi</h2>
        <button type="button" className="btn btn-neutral btn-sm" onClick={print} disabled={data.length === 0}>
          <Printer className="size-4" /> Cetak Laporan
        </button>
      </div>

      <div className="card no-print border border-base-300 bg-base-100">
        <form
          noValidate
          className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field name="startDate">{(f) => <TextField label="Dari Tanggal" field={f} type="date" />}</form.Field>
          <form.Field name="endDate">{(f) => <TextField label="Sampai Tanggal" field={f} type="date" />}</form.Field>
          <form.Field name="classId">
            {(f) => (
              <SelectField label="Kelas" field={f}>
                <option disabled selected value="">Semua Kelas</option>
                {options.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <button type="submit" className="btn btn-primary mt-6 w-full">Terapkan Filter</button>
        </form>
      </div>

      {/* Kop cetak */}
      <div className="print-only mb-6 hidden border-b pb-4 text-center">
        <h1 className="text-2xl font-bold">{settings.school_name}</h1>
        {settings.school_address ? <p className="text-sm">{settings.school_address}</p> : null}
        <h2 className="mt-2 text-lg font-semibold">Laporan Absensi Siswa</h2>
        <p className="text-base-content/70">Periode: {search.startDate || '-'} s.d {search.endDate || '-'}</p>
      </div>

      {urlCheck && !urlCheck.success ? <ErrorAlert message={urlCheck.error.issues[0]?.message} /> : null}
      {report.isFetching && urlCheck?.success ? <PageSpinner /> : null}
      <ErrorAlert message={report.error?.message} />

      {data.length > 0 ? (
        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 md:stats-horizontal">
          <div className="stat"><div className="stat-title">Total Data</div><div className="stat-value text-2xl text-primary">{data.length}</div></div>
          <div className="stat"><div className="stat-title">Hadir</div><div className="stat-value text-2xl text-success">{stats.hadir}</div></div>
          <div className="stat"><div className="stat-title">Sakit</div><div className="stat-value text-2xl text-warning">{stats.sakit}</div></div>
          <div className="stat"><div className="stat-title">Izin</div><div className="stat-value text-2xl text-info">{stats.izin}</div></div>
          <div className="stat"><div className="stat-title">Alpa</div><div className="stat-value text-2xl text-error">{stats.alpa}</div></div>
          <div className="stat"><div className="stat-title">Tingkat Kehadiran</div><div className="stat-value text-primary">{pct}</div></div>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable
          table={table}
          emptyText={search.go ? 'Tidak ada data ditemukan.' : 'Gunakan filter untuk menampilkan data laporan.'}
        />
        <Pager table={table} />
      </div>

      {/* Tanda tangan */}
      <div className="print-only mt-10 hidden">
        <div className="ml-auto w-64 text-center text-sm">
          <p>Mengetahui,<br />Kepala Sekolah</p>
          <p className="mt-16 font-semibold underline">{settings.principal_name || '\u00A0'}</p>
          {settings.principal_nip ? <p>NIP. {settings.principal_nip}</p> : null}
        </div>
      </div>
    </div>
  )
}