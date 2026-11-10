import type { LucideIcon } from "lucide-react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { ClipboardCheck, Eye, Play, StepForward } from "lucide-react";
import { useMemo } from "react";

import type { MyTask, SubmissionStatus } from "~/lib/types";

import { SubmissionStatusIcon } from "~/components/status-icons";
import { DataTable, Pager, Tip } from "~/components/ui";
import { nowLocalInput } from "~/lib/assignment-schema";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import { myTasksQuery, settingsQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";

export const Route = createFileRoute("/_app/tasks/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  loader: ({ context }) => context.queryClient.query(myTasksQuery),
  component: TasksPage,
});

const ACTION = {
  belum: {
    label: "Kerjakan",
    cls: "btn-primary",
    Icon: Play,
  },
  berlangsung: {
    label: "Lanjutkan",
    cls: "btn-primary",
    Icon: StepForward,
  },
  diserahkan: {
    label: "Lihat status",
    cls: "btn-ghost text-primary",
    Icon: Eye,
  },
  dinilai: {
    label: "Lihat hasil",
    cls: "btn-ghost text-primary",
    Icon: ClipboardCheck,
  },
} satisfies Record<
  SubmissionStatus,
  { label: string; cls: string; Icon: LucideIcon }
>;

/** `tz` = Settings.tz_offset_minutes: tenggat dibandingkan dengan jam zona waktu sekolah, sama dengan server. */
const isLate = (r: MyTask, tz?: number) =>
  r.status === "belum" && r.due_at !== "" && r.due_at <= nowLocalInput(tz);

function TaskActionCell({
  task,
  late,
}: Readonly<{ task: MyTask; late: boolean }>) {
  if (late) return null;
  const { label, cls, Icon } = ACTION[task.status];
  return (
    <Tip tip={label}>
      <Link
        to="/tasks/$assignmentId"
        params={{
          assignmentId: task.assignment_id,
        }}
        aria-label={label}
        className={`btn btn-xs ${cls}`}
      >
        <Icon className="size-4" />
      </Link>
    </Tip>
  );
}

const col = columnHelperFor<MyTask>();

function TaskTitleCell({ task }: Readonly<{ task: MyTask }>) {
  return (
    <>
      <div className="font-medium">{task.title}</div>
      <div className="text-xs text-base-content/60">
        {task.subject_name ? `${task.subject_name} · ` : ""}
        {task.question_count} soal - {task.max_score} poin
      </div>
    </>
  );
}

function TaskDueCell({ dueAt }: Readonly<{ dueAt: string }>) {
  return <span className="whitespace-nowrap">{formatDateTime(dueAt)}</span>;
}

function TaskScoreCell({ task }: Readonly<{ task: MyTask }>) {
  // Nilai hanya ada setelah status "dinilai" (esai sudah direview)
  return task.status === "dinilai" ? (
    <span className="font-semibold">{task.nilai}</span>
  ) : (
    <span className="text-base-content/40">-</span>
  );
}

function createTaskColumns(tz: number) {
  return col.columns([
    col.accessor("title", {
      header: "Tugas",
      cell: ({ row }) => <TaskTitleCell task={row.original} />,
    }),
    col.accessor((r) => r.due_at, {
      id: "due",
      header: "Tenggat",
      cell: (i) => <TaskDueCell dueAt={i.getValue()} />,
    }),
    col.accessor((r) => r.duration_minutes, {
      id: "duration",
      header: "Durasi",
      cell: (i) => (i.getValue() > 0 ? `${i.getValue()} menit` : "Bebas"),
    }),
    col.accessor("status", {
      header: "Status",
      cell: ({ row }) => (
        <SubmissionStatusIcon
          status={row.original.status}
          late={isLate(row.original, tz)}
        />
      ),
    }),
    col.display({
      id: "nilai",
      header: "Nilai",
      enableSorting: false,
      cell: ({ row }) => <TaskScoreCell task={row.original} />,
    }),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <TaskActionCell
          task={row.original}
          late={isLate(row.original, tz)}
        />
      ),
    }),
  ]);
}

function TasksPage() {
  const { data } = useSuspenseQuery(myTasksQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const tz = Number(settings.tz_offset_minutes);

  const columns = useMemo(() => createTaskColumns(tz), [tz]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Tugas Saya</h2>
      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable
          table={table}
          emptyText="Belum ada tugas untuk kelas Anda."
        />
        <Pager table={table} />
      </div>
    </div>
  );
}
