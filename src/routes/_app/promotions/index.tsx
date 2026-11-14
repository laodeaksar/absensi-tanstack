import { useForm, revalidateLogic } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { ArrowUpRight, Eye, GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import type { Student, StudentClass } from "~/lib/types";

import { PageHeader } from "~/components/status-icons";
import {
  ActionMenu,
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  SelectField,
} from "~/components/ui";
import { useConfirm } from "~/hooks/use-confirm";
import { api } from "~/lib/api";
import { allowRoles } from "~/lib/auth";
import {
  classesQuery,
  qk,
  studentClassesQuery,
  studentsQuery,
} from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/promotions/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  validateSearch: (s: Record<string, unknown>) => ({
    kelas: typeof s.kelas === "string" ? s.kelas : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(studentsQuery),
      context.queryClient.query(studentClassesQuery),
      context.queryClient.query(classesQuery),
    ]),
  component: PromotionsPage,
});

type PromotionRow = Student & {
  current_class_id: string;
  class_name: string;
  class_year: string;
};
const col = columnHelperFor<PromotionRow>();

type Handlers = {
  onPromote: (student: PromotionRow) => void;
  onGraduate: (student: PromotionRow) => void;
};

function createPromotionColumns({ onPromote, onGraduate }: Readonly<Handlers>) {
  return col.columns([
    col.accessor("nis", {
      header: "NIS",
      cell: (i) => `${i.getValue() || "-"}`,
    }),
    col.accessor("full_name", {
      header: "Nama Lengkap",
      cell: (i) => (
        <Link
          to="/students/$studentId"
          params={{ studentId: i.row.original.student_id }}
          className="link link-hover font-medium"
        >
          {i.getValue()}
        </Link>
      ),
    }),
    col.accessor("gender", { header: "L/P" }),
    col.accessor("class_name", {
      header: "Kelas",
      cell: (i) => (
        <span className="whitespace-nowrap">
          {i.getValue()} ({i.row.original.class_year || "-"})
        </span>
      ),
    }),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <ActionMenu>
          <li>
            <Link
              to="/students/$studentId"
              params={{ studentId: row.original.student_id }}
            >
              <Eye className="size-4" /> Detail
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onPromote(row.original)}
            >
              <ArrowUpRight className="size-4" /> Naik Kelas
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onGraduate(row.original)}
            >
              <GraduationCap className="size-4" /> Luluskan
            </button>
          </li>
        </ActionMenu>
      ),
    }),
  ]);
}

function PromotionsPage() {
  const { kelas } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: students } = useSuspenseQuery(studentsQuery);
  const { data: studentClasses } = useSuspenseQuery(studentClassesQuery);
  const { data: classes } = useSuspenseQuery(classesQuery);
  const [promoting, setPromoting] = useState<PromotionRow | null>(null);
  const [search, setSearch] = useState("");
  const { confirm, dialog } = useConfirm();

  const graduate = useMutation({
    mutationFn: (id: string) => api.graduateStudent(id),
    onSuccess: async (r) => {
      toast.success(r.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.students }),
        qc.invalidateQueries({ queryKey: qk.studentClasses }),
        qc.invalidateQueries({ queryKey: qk.dashboard }),
      ]);
    },
    onError: (e) => toast.error(e.message),
  });
  const graduateStudent = graduate.mutate;

  const columns = useMemo(
    () =>
      createPromotionColumns({
        onPromote: (student) => setPromoting(student),
        onGraduate: (student) => {
          void confirm(
            `Luluskan ${student.full_name}?\nRiwayat kelas ditutup, siswa dinonaktifkan, dan akun loginnya tidak bisa dipakai lagi.`,
          ).then((confirmed) => {
            if (confirmed) graduateStudent(student.student_id);
          });
        },
      }),
    [confirm, graduateStudent],
  );

  const classOptions = useMemo(
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

  // Hanya siswa aktif yang masih punya kelas aktif
  const rows = useMemo<PromotionRow[]>(() => {
    const byId = new Map(classes.map((c) => [c.class_id, c]));
    const latest = new Map<string, StudentClass>();
    for (const h of studentClasses) {
      const prev = latest.get(h.student_id);
      if (!prev || h.start_date > prev.start_date) latest.set(h.student_id, h);
    }
    const result: PromotionRow[] = [];
    for (const s of students) {
      if (!isActive(s.is_active)) continue;
      const c = byId.get(latest.get(s.student_id)?.class_id ?? "");
      if (!c) continue;
      result.push({
        ...s,
        current_class_id: c.class_id,
        class_name: c.class_name,
        class_year: c.academic_year,
      });
    }
    return result;
  }, [students, classes, studentClasses]);

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (s) =>
        (!kelas || s.current_class_id === kelas) &&
        (!q || `${s.full_name} ${s.nis}`.toLowerCase().includes(q)),
    );
  }, [rows, kelas, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Kenaikan Kelas" />

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="flex flex-col gap-2 border-b border-base-300 bg-base-200/60 p-4 sm:flex-row">
          <select
            className="select select-sm w-full sm:w-64"
            aria-label="Filter kelas"
            value={kelas ?? ""}
            onChange={(e) => {
              void navigate({
                search: { kelas: e.target.value || undefined },
                replace: true,
              });
              table.setPageIndex(0);
            }}
          >
            <option value="">Semua Kelas</option>
            {classOptions.map((c) => (
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
            onChange={(v) => {
              setSearch(v);
              table.setPageIndex(0);
            }}
            placeholder="Cari nama atau NIS..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Tidak ada siswa aktif di kelas ini."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={promoting !== null}
        onClose={() => setPromoting(null)}
        title="Naik Kelas"
      >
        {promoting ? (
          <PromoteForm
            key={promoting.student_id}
            student={promoting}
            onDone={() => setPromoting(null)}
            onCancel={() => setPromoting(null)}
          />
        ) : null}
      </Modal>
      {dialog}
    </div>
  );
}

const promoteSchema = z.object({
  class_id: z.string().min(1, "Pilih kelas tujuan"),
});

function PromoteForm({
  student,
  onDone,
  onCancel,
}: Readonly<{
  student: PromotionRow;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const qc = useQueryClient();
  const { data: classes } = useSuspenseQuery(classesQuery);
  const options = useMemo(
    () =>
      classes.filter(
        (c) => isActive(c.is_active) && c.class_id !== student.current_class_id,
      ),
    [classes, student.current_class_id],
  );

  const promote = useMutation({
    mutationFn: (classId: string) =>
      api.moveStudent(student.student_id, classId),
    onSuccess: async (r) => {
      toast.success(r.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.studentClasses }),
        qc.invalidateQueries({ queryKey: qk.attendance }),
        qc.invalidateQueries({ queryKey: qk.report }),
        qc.invalidateQueries({ queryKey: qk.dashboard }),
      ]);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: { class_id: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: promoteSchema },
    onSubmit: async ({ value }) => {
      await promote.mutateAsync(value.class_id).catch(() => {});
    },
  });

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="text-sm [overflow-wrap:anywhere]">
        <span className="font-medium">{student.full_name}</span> saat ini di{" "}
        {student.class_name} ({student.class_year || "-"}).
      </p>
      <form.Field name="class_id">
        {(f) => (
          <SelectField
            label="Kelas Tujuan"
            field={f}
          >
            <option
              disabled
              value=""
            >
              -- Pilih Kelas --
            </option>
            {options.map((c) => (
              <option
                key={c.class_id}
                value={c.class_id}
              >
                {c.class_name} ({c.academic_year || "-"})
              </option>
            ))}
          </SelectField>
        )}
      </form.Field>
      <ErrorAlert message={promote.error?.message} />
      <div className="modal-action">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
        >
          Batal
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={promote.isPending}
        >
          {promote.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : null}
          Naikkan
        </button>
      </div>
    </form>
  );
}
