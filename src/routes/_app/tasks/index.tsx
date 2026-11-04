import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { 
  CircleAlert, 
  CircleCheck, 
  CircleDashed, 
  ClipboardCheck, 
  ClipboardList, 
  Eye, 
  Hourglass, 
  Play, 
  StepForward
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { columnHelperFor, features } from '~/lib/table'
import { myTasksQuery } from '~/lib/queries'
import { nowLocalInput } from '~/lib/assignment-schema'
import type { MyTask, SubmissionStatus } from '~/lib/types'
import { DataTable, Pager, Tip } from '~/components/ui'

export const Route = createFileRoute('/_app/tasks/')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['siswa']),
  loader: ({ context }) => context.queryClient.query(myTasksQuery),
  component: TasksPage,
})

const STATUS = {
  belum: { label: 'Belum dikerjakan', cls: 'text-base-content/40', Icon: CircleDashed },
  berlangsung: { label: 'Sedang dikerjakan', cls: 'text-info', Icon: Hourglass },
  diserahkan: { label: 'Menunggu penilaian', cls: 'text-warning', Icon: ClipboardList },
  dinilai: { label: 'Sudah dinilai', cls: 'text-success', Icon: CircleCheck },
} satisfies Record<SubmissionStatus, { label: string; cls: string; Icon: LucideIcon }>

const LATE = { label: 'Lewat tenggat', cls: 'text-error', Icon: CircleAlert }

const ACTION = {
  belum: { label: 'Kerjakan', cls: 'btn-primary', Icon: Play },
  berlangsung: { label: 'Lanjutkan', cls: 'btn-primary', Icon: StepForward },
  diserahkan: { label: 'Lihat status', cls: 'btn-ghost text-primary', Icon: Eye },
  dinilai: { label: 'Lihat hasil', cls: 'btn-ghost text-primary', Icon: ClipboardCheck },
} satisfies Record<SubmissionStatus, { label: string; cls: string; Icon: LucideIcon }>

const isLate = (r: MyTask) => r.status === 'belum' && r.due_at !== '' && r.due_at <= nowLocalInput()

function TaskStatusCell({ task }: Readonly<{ task: MyTask }>) {
  const { label, cls, Icon } = isLate(task) ? LATE : STATUS[task.status]
  return (
    <Tip tip={label} side="right">
      <span role="img" aria-label={label} tabIndex={0} className={`inline-flex ${cls}`}>
        <Icon className="size-5" />
      </span>
    </Tip>
  )
}

function TaskActionCell({ task }: Readonly<{ task: MyTask }>) {
  if (isLate(task)) return null
  const { label, cls, Icon } = ACTION[task.status]
  return (
    <Tip tip={label}>
      <Link
        to="/tasks/$assignmentId"
        params={{ assignmentId: task.assignment_id }}
        aria-label={label}
        className={`btn btn-xs ${cls}`}
      >
        <Icon className="size-4" />
      </Link>
    </Tip>
  )
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
              <div className="text-xs text-base-content/60">
                {i.row.original.question_count} soal - {i.row.original.max_score} poin
              </div>
            </>
          ),
        }),
        col.accessor((r) => r.due_at, { 
          id: 'due', 
          header: 'Tenggat', 
          cell: (i) => fmtDue(i.getValue()) 
        }),
        col.accessor((r) => r.duration_minutes, {
          id: 'duration',
          header: 'Durasi',
          cell: (i) => (i.getValue() > 0 ? `${i.getValue()} menit` : 'Bebas'),
        }),
        col.accessor('status', {
          header: 'Status',
          cell: (i) => <TaskStatusCell task={i.row.original} />,
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
          cell: ({ row }) => <TaskActionCell task={row.original} />,
        }),
      ]),
    [],
  )

  const table = useTable({ 
    features, 
    columns, 
    data, 
    initialState: { 
      pagination: { 
        pageIndex: 0, 
        pageSize: 10 
      } 
    }
  })

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