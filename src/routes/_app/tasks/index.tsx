import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { allowRoles } from '~/lib/auth'
import { columnHelperFor, features } from '~/lib/table'
import { myTasksQuery } from '~/lib/tugas-queries'
import { nowLocalInput } from '~/lib/tugas-schema'
import type { MyTask, SubmissionStatus } from '~/lib/tugas-types'
import { DataTable, Pager } from '~/components/ui'

export const Route = createFileRoute('/_app/tasks/')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['siswa']),
  loader: ({ context }) => context.queryClient.ensureQueryData(myTasksQuery),
  component: TasksPage,
})

const STATUS: Record<SubmissionStatus, { label: string; cls: string }> = {
  belum: { label: 'Belum dikerjakan', cls: 'badge-ghost' },
  berlangsung: { label: 'Sedang dikerjakan', cls: 'badge-info' },
  diserahkan: { label: 'Menunggu penilaian', cls: 'badge-warning' },
  dinilai: { label: 'Sudah dinilai', cls: 'badge-success' },
}

const col = columnHelperFor<MyTask>()
const fmtDue = (s: string) => (s ? s.replace('T', ' ') : '-')

function TasksPage() {
  const { data } = useSuspenseQuery(myTasksQuery)

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('title', {
          header: 'Tugas',
          cell: (i) => (
            <>
              <div className="font-medium">{i.getValue()}</div>
              <div className="text-xs text-base-content/60">{i.row.original.question_count} soal - {i.row.original.max_score} poin</div>
            </>
          ),
        }),
        col.accessor((r) => r.due_at, { id: 'due', header: 'Tenggat', cell: (i) => fmtDue(i.getValue()) }),
        col.accessor((r) => r.duration_minutes, {
          id: 'duration',
          header: 'Durasi',
          cell: (i) => (i.getValue() > 0 ? `${i.getValue()} menit` : 'Bebas'),
        }),
        col.accessor('status', {
          header: 'Status',
          cell: (i) => {
            const r = i.row.original
            const late = r.status === 'belum' && r.due_at !== '' && r.due_at <= nowLocalInput()
            return late ? (
              <span className="badge badge-soft badge-error badge-sm">Lewat tenggat</span>
            ) : (
              <span className={`badge badge-soft badge-sm ${STATUS[i.getValue()].cls}`}>{STATUS[i.getValue()].label}</span>
            )
          },
        }),
        // Nilai hanya ada setelah status "dinilai" (esai sudah direview)
        col.display({
          id: 'nilai',
          header: 'Nilai',
          enableSorting: false,
          cell: ({ row }) =>
            row.original.status === 'dinilai' ? (
              <span className="font-semibold">{row.original.nilai}</span>
            ) : (
              <span className="text-base-content/40">-</span>
            ),
        }),
        col.display({
          id: 'actions',
          header: 'Aksi',
          enableSorting: false,
          cell: ({ row }) => {
            const r = row.original
            const late = r.status === 'belum' && r.due_at !== '' && r.due_at <= nowLocalInput()
            if (late) return null
            const label =
              r.status === 'belum' ? 'Kerjakan' : r.status === 'berlangsung' ? 'Lanjutkan' : r.status === 'dinilai' ? 'Lihat hasil' : 'Lihat status'
            return (
              <Link to="/tasks/$assignmentId" params={{ assignmentId: r.assignment_id }} className="btn btn-primary btn-xs">
                {label}
              </Link>
            )
          },
        }),
      ]),
    [],
  )

  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 10 } } })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Tugas Saya</h2>
      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable table={table} emptyText="Belum ada tugas untuk kelas Anda." />
        <Pager table={table} />
      </div>
    </div>
  )
}