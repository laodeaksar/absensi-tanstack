import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";

import type { StudentGrades } from "~/lib/types";

import { BackLink } from "~/components/back-link";
import { SemesterCell } from "~/components/grade-cells";
import { PageHeader } from "~/components/status-icons";
import { DataTable } from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { studentGradesQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";

export const Route = createFileRoute("/_app/grades-recap/$studentId")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  loader: ({ context, params }) =>
    context.queryClient.query(studentGradesQuery(params.studentId)),
  component: StudentGradesPage,
});

type SubjectRow = StudentGrades["periods"][number]["subjects"][number];
const col = columnHelperFor<SubjectRow>();

const columns = col.columns([
  col.accessor("subject_name", {
    header: "Mapel",
    cell: (i) => (
      <div>
        <p>{i.getValue()}</p>
        <p className="text-xs text-base-content/60">KKM {i.row.original.kkm}</p>
      </div>
    ),
  }),
  col.display({
    id: "ganjil",
    header: "Ganjil",
    enableSorting: false,
    cell: ({ row }) => (
      <SemesterCell
        cell={row.original.ganjil}
        components={row.original.components}
      />
    ),
  }),
  col.display({
    id: "genap",
    header: "Genap",
    enableSorting: false,
    cell: ({ row }) => (
      <SemesterCell
        cell={row.original.genap}
        components={row.original.components}
      />
    ),
  }),
]);

function PeriodTable({ subjects }: Readonly<{ subjects: SubjectRow[] }>) {
  const table = useTable({
    features,
    columns,
    data: subjects,
    initialState: { pagination: { pageIndex: 0, pageSize: 100 } },
  });
  return (
    <DataTable
      table={table}
      emptyText="Belum ada mapel di kelas ini."
    />
  );
}

function StudentGradesPage() {
  const { studentId } = Route.useParams();
  const { data } = useSuspenseQuery(studentGradesQuery(studentId));

  return (
    <div className="space-y-4">
      <div>
        <BackLink to="/grades-recap" />
        <PageHeader
          title={data.student.full_name}
          subtitle={
            <p className="text-sm text-base-content/60">
              NIS {data.student.nis || "-"} - Daftar Nilai
            </p>
          }
        />
      </div>

      {data.periods.length ? (
        data.periods.map((p) => (
          <div
            key={`${p.class_id}-${p.academic_year}`}
            className="card overflow-hidden border border-base-300 bg-base-100"
          >
            <div className="border-b border-base-300 bg-base-200/60 px-4 py-3">
              <p className="font-medium">
                {p.class_name}{" "}
                <span className="text-base-content/60">
                  - {p.academic_year || "-"}
                </span>
              </p>
              <p className="text-xs text-base-content/60">
                Tingkat {p.grade_level || "-"}
                {p.is_active ? " - Kelas aktif" : ""}
              </p>
            </div>
            <PeriodTable subjects={p.subjects} />
          </div>
        ))
      ) : (
        <p className="p-6 text-center text-sm text-base-content/60">
          Siswa belum pernah ditempatkan di kelas.
        </p>
      )}
    </div>
  );
}
