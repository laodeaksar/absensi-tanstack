import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import type { GradeRecapCell } from "~/lib/types";

import { EmptyState, NoResultsState } from "~/components/empty-state";
import { SemesterCell } from "~/components/grade-cells";
import { PageHeader } from "~/components/status-icons";
import { DataTable, Pager, SearchBox, TableSkeleton } from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { classesQuery, classGradeRecapQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/grades-recap/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s.kelas === "string" && { kelas: s.kelas }),
  }),
  loader: ({ context }) => context.queryClient.query(classesQuery),
  component: GradeRecapPage,
});

type RecapRow = {
  id: string;
  student_id: string;
  nis: string;
  full_name: string;
  subject_name: string;
  kkm: number;
  components: { key: string; label: string; weight: number }[];
  ganjil: GradeRecapCell | null;
  genap: GradeRecapCell | null;
};
const col = columnHelperFor<RecapRow>();

const columns = col.columns([
  col.accessor("full_name", {
    header: "Siswa",
    cell: (i) => (
      <div>
        <Link
          to="/grades-recap/$studentId"
          params={{ studentId: i.row.original.student_id }}
          className="link link-hover font-medium [overflow-wrap:anywhere]"
        >
          {i.getValue()}
        </Link>
        <p className="text-xs text-base-content/60">
          NIS {i.row.original.nis || "-"}
        </p>
      </div>
    ),
  }),
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

function GradeRecapPage() {
  const { kelas } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: classes } = useSuspenseQuery(classesQuery);
  const [search, setSearch] = useState("");

  const options = useMemo(
    () =>
      classes
        .filter((c) => isActive(c.is_active))
        .toSorted(
          (a, b) =>
            b.academic_year.localeCompare(a.academic_year) ||
            a.class_name.localeCompare(b.class_name),
        ),
    [classes],
  );
  const selected = options.find((c) => c.class_id === kelas) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title="Rekap Nilai" />
      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="flex flex-col gap-2 border-b border-base-300 bg-base-200/60 p-4 sm:flex-row">
          <select
            className="select w-full sm:w-64"
            aria-label="Pilih kelas"
            value={kelas ?? ""}
            onChange={(e) =>
              void navigate({
                search: { kelas: e.target.value || undefined },
                replace: true,
              })
            }
          >
            <option value="">-- Pilih Kelas --</option>
            {options.map((c) => (
              <option
                key={c.class_id}
                value={c.class_id}
              >
                {c.class_name} ({c.academic_year || "-"})
              </option>
            ))}
          </select>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Cari nama atau NIS..."
          />
        </div>
        {selected ? (
          <GradeRecapTable
            classId={selected.class_id}
            academicYear={selected.academic_year}
            search={search}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title="Pilih kelas"
            description="Pilih kelas untuk melihat rekap nilai siswanya."
          />
        )}
      </div>
    </div>
  );
}

type GradeRecapTableProps = {
  classId: string;
  academicYear: string;
  search: string;
};

function GradeRecapTable({
  classId,
  academicYear,
  search,
}: GradeRecapTableProps) {
  const { data } = useSuspenseQuery(
    classGradeRecapQuery({
      classId,
      academicYear,
    }),
  );

  const rows = useMemo<RecapRow[]>(() => {
    const q = search.trim().toLowerCase();
    const subjects = new Map(data.subjects.map((s) => [s.subject_id, s]));

    const result: RecapRow[] = [];

    for (const s of data.students) {
      if (q && !`${s.full_name} ${s.nis}`.toLowerCase().includes(q)) {
        continue;
      }

      for (const g of s.grades) {
        const sub = subjects.get(g.subject_id);
        if (!sub) continue;

        result.push({
          id: `${s.student_id}|${g.subject_id}`,
          student_id: s.student_id,
          nis: s.nis,
          full_name: s.full_name,
          subject_name: sub.subject_name,
          kkm: sub.kkm,
          components: sub.components,
          ganjil: g.ganjil,
          genap: g.genap,
        });
      }
    }

    return result;
  }, [data, search]);

  const table = useTable({
    features,
    columns,
    data: rows,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
  });

  const empty = search.trim() ? (
    <NoResultsState
      subject="Siswa"
      query={search.trim()}
      onClear={() => {}}
    />
  ) : (
    <EmptyState
      icon={<ClipboardList />}
      title="Belum ada data nilai"
      description="Kelas ini belum memiliki siswa aktif atau pengampu mata pelajaran."
    />
  );

  return (
    <Suspense
      fallback={
        <TableSkeleton
          rows={4}
          cols={5}
        />
      }
    >
      <DataTable
        table={table}
        empty={empty}
      />
      <Pager table={table} />
    </Suspense>
  );
}
