import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { ClassInput, ClassRow } from "~/lib/types";

import { PageHeader, HeaderButton } from "~/components/status-icons";
import {
  ActiveStatusIcon,
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  CheckboxField,
  SelectField,
  TextField,
  Tip,
} from "~/components/ui";
import { api } from "~/lib/api";
import { allowRoles } from "~/lib/auth";
import { makeClassSchema } from "~/lib/class-schema";
import { classesQuery, qk, settingsQuery, teachersQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/classes")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(classesQuery),
      context.queryClient.query(teachersQuery),
      context.queryClient.query(settingsQuery),
    ]),
  component: ClassesPage,
});

type Row = ClassRow & { homeroom_name: string };
const col = columnHelperFor<Row>();

type Handlers = {
  onEdit: (cls: ClassRow) => void;
};

function ClassActionsCell({ cls, onEdit }: Readonly<{ cls: Row } & Handlers>) {
  return (
    <Tip tip="Edit">
      <button
        type="button"
        aria-label="Edit"
        className="btn btn-ghost btn-xs text-primary"
        onClick={() => onEdit(cls)}
      >
        <Pencil className="size-4" />
      </button>
    </Tip>
  );
}

function createClassColumns({ onEdit }: Readonly<Handlers>) {
  return col.columns([
    col.accessor("class_name", {
      header: "Nama Kelas",
      cell: (i) => <span className="font-medium">{i.getValue()}</span>,
    }),
    col.accessor("grade_level", {
      header: "Tingkat",
    }),
    col.accessor("academic_year", {
      header: "Tahun Ajaran",
    }),
    col.accessor("homeroom_name", {
      header: "Wali Kelas",
    }),
    col.accessor((r) => (isActive(r.is_active) ? "Aktif" : "Nonaktif"), {
      id: "status",
      header: "Status",
      cell: (i) => <ActiveStatusIcon active={i.getValue() === "Aktif"} />,
    }),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <ClassActionsCell
          cls={row.original}
          onEdit={onEdit}
        />
      ),
    }),
  ]);
}

function ClassesPage() {
  const qc = useQueryClient();
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: teachers } = useSuspenseQuery(teachersQuery);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    cls: ClassRow | null;
  }>({
    open: false,
    cls: null,
  });

  const columns = useMemo(
    () =>
      createClassColumns({
        onEdit: (cls) => setModal({ open: true, cls }),
      }),
    [],
  );

  const data = useMemo<Row[]>(() => {
    const names = new Map(teachers.map((t) => [t.user_id, t.full_name]));
    const q = search.trim().toLowerCase();
    return classes
      .map((c) => ({
        ...c,
        homeroom_name: names.get(c.homeroom_teacher) ?? "-",
      }))
      .filter(
        (c) =>
          !q ||
          `${c.class_name} ${c.homeroom_name} ${c.academic_year}`
            .toLowerCase()
            .includes(q),
      );
  }, [classes, teachers, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Master Data Kelas">
        <HeaderButton
          label="Tambah Kelas"
          icon={<Plus className="size-4" />}
          onClick={() => setModal({ open: true, cls: null })}
        />
      </PageHeader>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              table.setPageIndex(0);
            }}
            placeholder="Cari kelas..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Tidak ada data kelas."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.cls ? "Edit Kelas" : "Tambah Kelas"}
      >
        {modal.open ? (
          <ClassForm
            key={modal.cls?.class_id ?? "new"}
            cls={modal.cls}
            onDone={() => {
              setModal({ open: false, cls: null });
              void qc.invalidateQueries({
                queryKey: qk.classes,
              });
              void qc.invalidateQueries({
                queryKey: qk.dashboard,
              });
            }}
            onCancel={() =>
              setModal((m) => ({
                ...m,
                open: false,
              }))
            }
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ClassForm({
  cls,
  onDone,
  onCancel,
}: Readonly<{
  cls: ClassRow | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: teachers } = useSuspenseQuery(teachersQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  // Wali kelas: guru aktif, ditambah wali saat ini (walau sudah nonaktif) saat mengedit
  const teacherOptions = useMemo(
    () =>
      teachers.filter(
        (t) => isActive(t.is_active) || t.user_id === cls?.homeroom_teacher,
      ),
    [teachers, cls?.homeroom_teacher],
  );

  // Aturan dibuat dari data terbaru, jadi cek duplikat selalu sesuai isi daftar kelas
  const schema = useMemo(
    () =>
      makeClassSchema({
        classes,
        editingId: cls?.class_id,
        teacherIds: teacherOptions.map((t) => t.user_id),
        teacherNames: Object.fromEntries(
          teachers.map((t) => [t.user_id, t.full_name]),
        ),
        original: cls
          ? {
              homeroom_teacher: cls.homeroom_teacher,
              academic_year: cls.academic_year,
              is_active: isActive(cls.is_active),
            }
          : undefined,
      }),
    [classes, teachers, cls, teacherOptions],
  );

  // Saran tingkat dari kelas yang sudah ada
  const gradeSuggestions = useMemo(
    () =>
      [...new Set(classes.map((c) => c.grade_level).filter(Boolean))].sort(),
    [classes],
  );

  const save = useMutation({
    mutationFn: (v: ClassInput) => api.saveClass(v),
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      class_name: cls?.class_name ?? "",
      homeroom_teacher: cls?.homeroom_teacher ?? "",
      grade_level: cls?.grade_level ?? "",
      academic_year: cls?.academic_year ?? settings.active_academic_year ?? "",
      is_active: cls ? isActive(cls.is_active) : true,
    },
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          class_id: cls?.class_id ?? "",
          class_name: value.class_name.trim(),
          grade_level: value.grade_level.trim(),
          academic_year: value.academic_year.trim(),
          homeroom_teacher: value.homeroom_teacher,
          // Kelas baru selalu aktif; status hanya diubah saat edit
          ...(cls ? { is_active: value.is_active } : {}),
        })
        .catch(() => {});
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
      <form.Field name="class_name">
        {(f) => (
          <TextField
            label="Nama Kelas"
            field={f}
            placeholder="Misal: X MIPA 1"
          />
        )}
      </form.Field>

      <form.Field name="homeroom_teacher">
        {(f) => (
          <SelectField
            label="Wali Kelas"
            field={f}
          >
            <option value="">-- Tanpa Wali Kelas --</option>
            {teacherOptions.map((t) => (
              <option
                key={t.user_id}
                value={t.user_id}
              >
                {t.full_name}
                {isActive(t.is_active) ? "" : " (nonaktif)"}
              </option>
            ))}
          </SelectField>
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="grade_level">
          {(f) => (
            <TextField
              label="Tingkat"
              field={f}
              list="grade-levels"
              autoComplete="off"
            />
          )}
        </form.Field>
        <form.Field name="academic_year">
          {(f) => (
            <TextField
              label="Tahun Ajaran"
              field={f}
              placeholder="2025/2026"
              hint={
                settings.active_academic_year
                  ? `Tahun ajaran aktif: ${settings.active_academic_year}`
                  : undefined
              }
            />
          )}
        </form.Field>
      </div>
      {cls ? (
        <form.Field name="is_active">
          {(f) => (
            <CheckboxField
              label="Kelas aktif"
              field={f}
              hint="Kelas nonaktif tidak muncul di pilihan absensi, laporan, dan tugas baru."
            />
          )}
        </form.Field>
      ) : null}
      <datalist id="grade-levels">
        {gradeSuggestions.map((g) => (
          <option
            key={g}
            value={g}
          />
        ))}
      </datalist>

      <ErrorAlert message={save.error?.message} />

      <div className="modal-action">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
        >
          Batal
        </button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
            >
              {busy ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              Simpan
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
