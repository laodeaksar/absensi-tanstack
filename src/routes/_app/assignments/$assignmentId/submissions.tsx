import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { columnHelperFor, features } from '~/lib/table'
import { submissionsQuery } from '~/lib/tugas-queries'
import type { SubmissionRow, SubmissionStatus } from '~/lib/tugas-types'
import { DataTable, Pager, SearchBox } from '~/components/ui'

export const Route = createFileRoute('/_app/assignments/$assignmentId/submissions')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(submissionsQuery(params.assignmentId)),
  component: SubmissionsPage,
})

const STATUS: Record<SubmissionStatus, { label: string; cls: string }> = {
  belum: { label: 'Belum mengerjakan', cls: 'badge-ghost' },
  berlangsung: { label: 'Sedang mengerjakan', cls: 'badge-info' },
  diserahkan: { label: 'Perlu dinilai', cls: 'badge-warning' },
  dinilai: { label: 'Sudah dinilai', cls: 'badge-success' },
}

const col = columnHelperFor<SubmissionRow>()

function SubmissionsPage() {
  const { assignmentId } = Route.useParams()
  const { data: res } = useSuspenseQuery(submissionsQuery(assignmentId))
  const [search, setSearch] = useState('')

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('nis', { header: 'NIS' }),
        col.accessor('full_name', { header: 'Nama Siswa', cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
        col.accessor('status', {
          header: 'Status',
          cell: (i) => <span className={`badge badge-soft badge-sm ${STATUS[i.getValue()].cls}`}>{STATUS[i.getValue()].label}</span>,
        }),
        col.display({
          id: 'score',
          header: 'Nilai',
          enableSorting: false,
          cell: ({ row }) => {
            const r = row.original
            if (r.status === 'dinilai') return <span className="font-medium">{r.nilai} <span className="text-xs text-base-content/60">({r.score}/{r.max_score})</span></span>
            if (r.status === 'diserahkan') return <span className="text-xs text-base-content/60">Pilihan ganda: {r.score}</span>
            return <span className="text-base-content/40">-</span>
          },
        }),
        col.accessor((r) => r.submitted_at, {
          id: 'submitted',
          header: 'Dikumpulkan',
          cell: (i) => (i.getValue() === '' ? '-' : new Date(Number(i.getValue())).toLocaleString('id-ID')),
        }),
        col.display({
          id: 'actions',
          header: 'Aksi',
          enableSorting: false,
          cell: ({ row }) => {
            const r = row.original
            if (r.status !== 'diserahkan' && r.status !== 'dinilai') return null
            return (
              <Link
                to="/assignments/$assignmentId/review/$submissionId"
                params={{ assignmentId, submissionId: r.submission_id }}
                className="btn btn-ghost btn-xs text-primary"
              >
                {r.status === 'diserahkan' ? 'Nilai' : 'Lihat / Ubah'}
              </Link>
            )
          },
        }),
      ]),
    [assignmentId],
  )

  const data = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? res.data.filter((r) => `${r.full_name} ${r.nis}`.toLowerCase().includes(q)) : res.data
  }, [res.data, search])

  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 20 } } })

  const count = (s: SubmissionStatus) => res.data.filter((r) => r.status === s).length

  return (
    <div className="space-y-4">
      <div>
        <Link to="/assignments" className="btn btn-ghost btn-xs mb-1 -ml-2"><ArrowLeft className="size-4" /> Kembali</Link>
        <h2 className="text-2xl font-bold">Pengumpulan: {res.assignment.title}</h2>
        <p className="text-sm text-base-content/60">Kelas {res.assignment.class_name} - total {res.assignment.max_score} poin</p>
      </div>

      <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat"><div className="stat-title">Belum</div><div className="stat-value text-2xl">{count('belum')}</div></div>
        <div className="stat"><div className="stat-title">Mengerjakan</div><div className="stat-value text-2xl text-info">{count('berlangsung')}</div></div>
        <div className="stat"><div className="stat-title">Perlu dinilai</div><div className="stat-value text-2xl text-warning">{count('diserahkan')}</div></div>
        <div className="stat"><div className="stat-title">Sudah dinilai</div><div className="stat-value text-2xl text-success">{count('dinilai')}</div></div>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox value={search} onChange={(v) => { setSearch(v); table.setPageIndex(0) }} placeholder="Cari nama atau NIS..." />
        </div>
        <DataTable table={table} emptyText="Belum ada siswa di kelas ini." />
        <Pager table={table} />
      </div>
    </div>
  )
}