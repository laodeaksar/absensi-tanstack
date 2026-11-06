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

function TasksPage() {
  const { data } = useSuspenseQuery(myTasksQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const tz = Number(settings.tz_offset_minutes);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("title", {
          header: "Tugas",
          cell: (i) => (
            <>
              <div className="font-medium">{i.getValue()}</div>
              <div className="text-xs text-base-content/60">
                {i.row.original.subject_name
                  ? `${i.row.original.subject_name} · `
                  : ""}
                {i.row.original.question_count} soal -{" "}
                {i.row.original.max_score} poin
              </div>
            </>
          ),
        }),
        col.accessor((r) => r.due_at, {
          id: "due",
          header: "Tenggat",
          cell: (i) => (
            <span className="whitespace-nowrap">
              {formatDateTime(i.getValue())}
            </span>
          ),
        }),
        col.accessor((r) => r.duration_minutes, {
          id: "duration",
          header: "Durasi",
          cell: (i) => (i.getValue() > 0 ? `${i.getValue()} menit` : "Bebas"),
        }),
        col.accessor("status", {
          header: "Status",
          cell: (i) => (
            <SubmissionStatusIcon
              status={i.row.original.status}
              late={isLate(i.row.original, tz)}
            />
          ),
        }),
        // Nilai hanya ada setelah status "dinilai" (esai sudah direview)
        col.display({
          id: "nilai",
          header: "Nilai",
          enableSorting: false,
          cell: ({ row }) =>
            row.original.status === "dinilai" ? (
              <span className="font-semibold">{row.original.nilai}</span>
            ) : (
              <span className="text-base-content/40">-</span>
            ),
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
      ]),
    [tz],
  );

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
