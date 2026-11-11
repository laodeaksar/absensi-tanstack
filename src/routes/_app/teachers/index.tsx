import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Eye, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import type { Teacher, TeacherInput } from "~/lib/types";

import { CheckboxGroupField } from "~/components/checkbox-group-field";
import { PasswordStrength } from "~/components/password-strength";
import { PageHeader, HeaderButton } from "~/components/status-icons";
import {
  ActiveStatusIcon,
  ActionMenu,
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  TextField,
  PasswordField,
} from "~/components/ui";
import { useConfirm } from "~/hooks/use-confirm";
import { api } from "~/lib/api";
import { allowRoles } from "~/lib/auth";
import { classesQuery, qk, teachersQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { makeTeacherSchema } from "~/lib/teacher-schema";
import { toast } from "~/lib/toast";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/teachers/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  validateSearch: (s: Record<string, unknown>) => ({
    // id guru yang langsung dibuka di form Edit (dipakai tombol Edit di halaman detail)
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(teachersQuery),
      context.queryClient.query(classesQuery),
    ]),
  component: TeachersPage,
});

type Row = Teacher & {
  class_names: string[];
  active: boolean;
};
const col = columnHelperFor<Row>();

function TeacherNameCell({ teacher }: Readonly<{ teacher: Row }>) {
  return (
    <>
      <Link
        to="/teachers/$teacherId"
        params={{ teacherId: teacher.user_id }}
        className="link link-hover font-medium"
      >
        {teacher.full_name}
      </Link>
      {teacher.nip ? (
        <div className="text-xs text-base-content/60">NIP {teacher.nip}</div>
      ) : null}
    </>
  );
}

function TeacherContactCell({ teacher }: Readonly<{ teacher: Row }>) {
  if (!teacher.phone && !teacher.email)
    return <span className="text-base-content/40">-</span>;
  return (
    <>
      {teacher.phone ? <div>{teacher.phone}</div> : null}
      {teacher.email ? (
        <div className="text-xs text-base-content/60">{teacher.email}</div>
      ) : null}
    </>
  );
}

function TeacherClassesCell({ teacher }: Readonly<{ teacher: Row }>) {
  if (!teacher.class_names.length)
    return <span className="text-base-content/40">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {teacher.class_names.map((name) => (
        <span
          key={name}
          className="badge badge-ghost badge-sm"
        >
          {name}
        </span>
      ))}
    </div>
  );
}

type Handlers = {
  onEdit: (teacher: Teacher) => void;
  onToggle: (teacher: Row) => void;
};

function TeacherActionsCell({
  teacher,
  onEdit,
  onToggle,
}: Readonly<{ teacher: Row } & Handlers>) {
  return (
    <ActionMenu>
      <li>
        <Link
          to="/teachers/$teacherId"
          params={{ teacherId: teacher.user_id }}
        >
          <Eye className="size-4" /> Detail
        </Link>
      </li>
      <li>
        <button
          type="button"
          onClick={() => onEdit(teacher)}
        >
          <Pencil className="size-4" /> Edit
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => onToggle(teacher)}
        >
          {teacher.active ? (
            <UserX className="size-4" />
          ) : (
            <UserCheck className="size-4" />
          )}
          {teacher.active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </li>
    </ActionMenu>
  );
}

function createTeacherColumns({ onEdit, onToggle }: Readonly<Handlers>) {
  return col.columns([
    col.accessor("full_name", {
      header: "Nama Lengkap",
      cell: ({ row }) => <TeacherNameCell teacher={row.original} />,
    }),
    col.accessor("username", {
      header: "Username",
    }),
    col.display({
      id: "contact",
      header: "Kontak",
      enableSorting: false,
      cell: ({ row }) => <TeacherContactCell teacher={row.original} />,
    }),
    col.display({
      id: "classes",
      header: "Kelas Diampu",
      enableSorting: false,
      cell: ({ row }) => <TeacherClassesCell teacher={row.original} />,
    }),
    col.accessor((r) => (r.active ? "Aktif" : "Nonaktif"), {
      id: "status",
      header: "Status",
      cell: (i) => <ActiveStatusIcon active={i.getValue() === "Aktif"} />,
    }),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <TeacherActionsCell
          teacher={row.original}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ),
    }),
  ]);
}

function TeachersPage() {
  const { edit } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: teachers } = useSuspenseQuery(teachersQuery);
  const { data: classes } = useSuspenseQuery(classesQuery);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    teacher: Teacher | null;
  }>({
    open: false,
    teacher: null,
  });
  const { confirm, dialog } = useConfirm();

  // ?edit=<id> membuka form Edit guru itu, baik saat halaman baru dibuka (dari halaman detail)
  // maupun saat parameternya berubah ketika halaman sudah terbuka. Menyesuaikan state saat render
  // dengan syarat (pola dari dokumentasi React), bukan setState di dalam efek.
  const [seenEdit, setSeenEdit] = useState<string | undefined>(undefined);
  if (edit !== seenEdit) {
    setSeenEdit(edit);
    const t = edit ? teachers.find((x) => x.user_id === edit) : undefined;
    if (t) setModal({ open: true, teacher: t });
  }

  // Hapus parameter dari URL agar refresh atau tombol kembali tidak membukanya lagi
  useEffect(() => {
    if (edit)
      void navigate({
        to: "/teachers",
        search: { edit: undefined },
        replace: true,
      });
  }, [edit, navigate]);

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; is_active: boolean }) =>
      api.saveTeacher(v),
    onSuccess: (_r, v) => {
      toast.success(
        v.is_active ? "Akun guru diaktifkan" : "Akun guru dinonaktifkan",
      );
      void qc.invalidateQueries({
        queryKey: qk.teachers,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleTeacher = toggle.mutate; // stabil, berbeda dari objek `toggle` yang baru tiap render

  const columns = useMemo(
    () =>
      createTeacherColumns({
        onEdit: (teacher) => setModal({ open: true, teacher }),
        onToggle: async (teacher) => {
          void confirm(
            teacher.active
              ? `Nonaktifkan akun ${teacher.full_name}?\nGuru tidak dapat login sampai diaktifkan kembali.`
              : `Aktifkan kembali akun ${teacher.full_name}?`,
          ).then((confirmed) => {
            if (confirmed)
              toggleTeacher({
                user_id: teacher.user_id,
                is_active: !teacher.active,
              });
          });
        },
      }),
    [confirm, toggleTeacher],
  );

  const data = useMemo<Row[]>(() => {
    const names = new Map(classes.map((c) => [c.class_id, c.class_name]));
    const q = search.trim().toLowerCase();
    return teachers
      .map((t) => ({
        ...t,
        active: isActive(t.is_active),
        class_names: t.assigned_classes
          .map((id) => names.get(id))
          .filter((n): n is string => !!n),
      }))
      .filter(
        (t) =>
          !q ||
          `${t.full_name} ${t.username} ${t.nip}`.toLowerCase().includes(q),
      );
  }, [teachers, classes, search]);

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
      <PageHeader title="Manajemen Guru">
        <HeaderButton
          label="Tambah Guru"
          icon={<Plus className="size-4" />}
          onClick={() =>
            setModal({
              open: true,
              teacher: null,
            })
          }
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
            placeholder="Cari nama atau username..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Belum ada data guru."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.teacher ? "Edit Guru" : "Tambah Guru"}
      >
        {modal.open ? (
          <TeacherForm
            key={modal.teacher?.user_id ?? "new"}
            teacher={modal.teacher}
            onDone={() => {
              setModal({
                open: false,
                teacher: null,
              });
              void qc.invalidateQueries({
                queryKey: qk.teachers,
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
      {dialog}
    </div>
  );
}

function TeacherForm({
  teacher,
  onDone,
  onCancel,
}: {
  teacher: Teacher | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: teachers } = useSuspenseQuery(teachersQuery);
  const isNew = !teacher;
  const assigned = useMemo(
    () => (teacher ? teacher.assigned_classes : []),
    [teacher],
  );

  // Kelas yang bisa dipilih: kelas aktif + kelas yang sudah diampu guru ini
  const visibleClasses = useMemo(
    () =>
      classes.filter(
        (c) => isActive(c.is_active) || assigned.includes(c.class_id),
      ),
    [classes, assigned],
  );

  // Aturan dibuat dari data terbaru: username/NIP ganda, kelas valid, password wajib hanya untuk guru baru
  const schema = useMemo(
    () =>
      makeTeacherSchema({
        teachers,
        editingId: teacher?.user_id,
        classIds: visibleClasses.map((c) => c.class_id),
      }),
    [teachers, teacher?.user_id, visibleClasses],
  );

  const save = useMutation({
    mutationFn: (v: TeacherInput) => api.saveTeacher(v),
    onSuccess: (r) => {
      toast.success(r.message || "Data guru tersimpan");
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      full_name: teacher?.full_name ?? "",
      nip: teacher?.nip ?? "",
      phone: teacher?.phone ?? "",
      email: teacher?.email ?? "",
      username: teacher?.username ?? "",
      password: "",
      assigned_classes: assigned,
      is_active: teacher ? isActive(teacher.is_active) : true,
    },
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      const payload: TeacherInput = {
        user_id: teacher?.user_id ?? "",
        full_name: value.full_name.trim(),
        nip: value.nip.trim(),
        phone: value.phone.trim(),
        email: value.email.trim(),
        username: value.username.trim(),
        assigned_classes: value.assigned_classes,
        is_active: value.is_active,
      };
      if (value.password) payload.password = value.password;
      await save.mutateAsync(payload).catch(() => {});
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
      <form.Field name="full_name">
        {(f) => (
          <TextField
            label="Nama Lengkap"
            field={f}
          />
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="nip">
          {(f) => (
            <TextField
              label="NIP"
              field={f}
              inputMode="numeric"
            />
          )}
        </form.Field>
        <form.Field name="phone">
          {(f) => (
            <TextField
              label="No. HP"
              field={f}
              inputMode="tel"
            />
          )}
        </form.Field>
      </div>

      <form.Field name="email">
        {(f) => (
          <TextField
            label="Email"
            field={f}
            type="email"
          />
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="username">
          {(f) => (
            <TextField
              label="Username"
              field={f}
              autoComplete="off"
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(f) => (
            <PasswordField
              label="Password"
              field={f}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              placeholder={
                isNew ? "Minimal 8 karakter" : "Kosongkan jika tidak diubah"
              }
            />
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.values}>
        {(v) => (
          <PasswordStrength
            value={v.password}
            forbidden={[v.username, v.full_name, v.nip, v.phone]}
          />
        )}
      </form.Subscribe>

      <form.Field name="assigned_classes">
        {(f) => (
          <CheckboxGroupField
            label="Kelas yang Diampu"
            field={f}
            emptyText="Belum ada kelas aktif."
            options={visibleClasses.map((c) => ({
              value: c.class_id,
              label: (
                <>
                  {c.class_name}{" "}
                  <span className="text-base-content/40">
                    ({c.academic_year || "-"})
                  </span>
                </>
              ),
            }))}
          />
        )}
      </form.Field>

      <form.Field name="is_active">
        {(f) => (
          <label className="flex cursor-pointer items-center gap-2 pt-2 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={f.state.value}
              onChange={(e) => f.handleChange(e.target.checked)}
            />
            <span>Akun aktif (dapat login)</span>
          </label>
        )}
      </form.Field>

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
