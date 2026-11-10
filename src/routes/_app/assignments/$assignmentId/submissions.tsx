import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Eye, PenLine } from "lucide-react";
import { useMemo, useState } from "react";

import type { SubmissionRow, SubmissionStatus } from "~/lib/types";

import { BackLink } from "~/components/back-link";
import { SubmissionStatusIcon } from "~/components/status-icons";
import { DataTable, Pager, SearchBox, Tip } from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import { submissionsQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";

export const Route = createFileRoute(
  "/_app/assignments/$assignmentId/submissions",
)({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context, params }) =>
    context.queryClient.query(submissionsQuery(params.assignmentId)),
  component: SubmissionsPage,
});

const col = columnHelperFor<SubmissionRow>();

function StudentNameCell({ name }: Readonly<{ name: string }>) {
  return <span className="font-medium">{name}</span>;
}

function SubmissionScoreCell({ row }: Readonly<{ row: SubmissionRow }>) {
  if (row.status === "dinilai") {
    return (
      <span className="whitespace-nowrap font-medium">
        {row.nilai}
        <span className="ml-1 text-xs font-normal text-base-content/60">
          ({row.score}/{row.max_score})
        </span>
      </span>
    );
  }
  if (row.status === "diserahkan") {
    return (
      <Tip
        tip="Skor pilihan ganda, esai belum dinilai"
        side="top"
      >
        <span
          tabIndex={0}
          className="text-sm text-base-content/60"
        >
          {row.score}
        </span>
      </Tip>
    );
  }
  return <span className="text-base-content/40">-</span>;
}

/** Waktu kumpul (epoch ms) dengan format tampilan yang sama dengan halaman lain. */
function SubmittedAtCell({ value }: Readonly<{ value: number | "" }>) {
  return <span className="whitespace-nowrap">{formatDateTime(value)}</span>;
}

function SubmissionActionCell({
  row,
  assignmentId,
}: Readonly<{
  row: SubmissionRow;
  assignmentId: string;
}>) {
  if (row.status !== "diserahkan" && row.status !== "dinilai") return null;
  const graded = row.status === "dinilai";
  const label = graded ? "Lihat / Ubah" : "Nilai";
  return (
    <Tip tip={label}>
      <Link
        to="/assignments/$assignmentId/review/$submissionId"
        params={{
          assignmentId,
          submissionId: row.submission_id,
        }}
        aria-label={label}
        className="btn btn-ghost btn-xs text-primary"
      >
        {graded ? <Eye className="size-4" /> : <PenLine className="size-4" />}
      </Link>
    </Tip>
  );
}

function createSubmissionColumns(assignmentId: string) {
  return col.columns([
    col.accessor("nis", { header: "NIS" }),
    col.accessor("full_name", {
      header: "Nama Siswa",
      cell: (cell) => <StudentNameCell name={cell.getValue()} />,
    }),
    col.accessor("status", {
      header: "Status",
      cell: (cell) => <SubmissionStatusIcon status={cell.getValue()} />,
    }),
    col.display({
      id: "score",
      header: "Nilai",
      enableSorting: false,
      cell: ({ row }) => <SubmissionScoreCell row={row.original} />,
    }),
    col.accessor(
      (row) => (row.submitted_at === "" ? undefined : Number(row.submitted_at)),
      {
        id: "submitted",
        header: "Dikumpulkan",
        sortUndefined: "last", // jika opsi ini ada di versi tabel Anda
        cell: (cell) => <SubmittedAtCell value={cell.getValue() ?? ""} />,
      },
    ),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <SubmissionActionCell
          row={row.original}
          assignmentId={assignmentId}
        />
      ),
    }),
  ]);
}

function SubmissionsPage() {
  const { assignmentId } = Route.useParams();
  // Muat ulang tiap 30 detik: guru memantau siswa yang baru mengumpulkan atau yang waktunya habis
  const { data: res } = useSuspenseQuery(submissionsQuery(assignmentId));
  const [search, setSearch] = useState("");

  const columns = useMemo(
    () => createSubmissionColumns(assignmentId),
    [assignmentId],
  );

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? res.data.filter((r) =>
          `${r.full_name} ${r.nis}`.toLowerCase().includes(q),
        )
      : res.data;
  }, [res.data, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
  });

  const count = (s: SubmissionStatus) =>
    res.data.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div>
        <BackLink to="/assignments" />
        <h2 className="text-2xl font-bold">
          Pengumpulan: {res.assignment.title}
        </h2>
        <p className="text-sm text-base-content/60">
          Kelas {res.assignment.class_name} - total {res.assignment.max_score}{" "}
          poin
        </p>
      </div>

      <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">Belum</div>
          <div className="stat-value text-2xl">{count("belum")}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Mengerjakan</div>
          <div className="stat-value text-2xl text-info">
            {count("berlangsung")}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Perlu dinilai</div>
          <div className="stat-value text-2xl text-warning">
            {count("diserahkan")}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Sudah dinilai</div>
          <div className="stat-value text-2xl text-success">
            {count("dinilai")}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              table.setPageIndex(0);
            }}
            placeholder="Cari nama atau NIS..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Belum ada siswa di kelas ini."
        />
        <Pager table={table} />
      </div>
    </div>
  );
}
