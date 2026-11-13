import { useForm, revalidateLogic } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { KeyRound, Plus, Pencil, ArrowRightLeft, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { Student, StudentClass, StudentInput } from "~/lib/types";

import { PageHeader, HeaderButton } from "~/components/status-icons";
import {
  ActiveStatusIcon,
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  SelectField,
  TextField,
  ActionMenu,
  RadioField,
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
import { makeStudentSchema } from "~/lib/student-schema";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/students/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  validateSearch: (s: Record<string, unknown>) => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
    // true = form Edit dibuka dari halaman detail, jadi kembali ke sana setelah selesai
    back: s.back === true || s.back === "true" ? true : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(studentsQuery),
      context.queryClient.query(studentClassesQuery),
      context.queryClient.query(classesQuery),
    ]),
  component: StudentsPage,
});

type StudentRow = Student & {
  current_class_id: string;
  class_name: string;
  class_year: string;
};
const col = columnHelperFor<StudentRow>();

function StudentNameCell({
  studentId,
  name,
}: Readonly<{ studentId: string; name: string }>) {
  return (
    <Link
      to="/students/$studentId"
      params={{ studentId }}
      className="link link-hover font-medium"
    >
      {name}
    </Link>
  );
}

function StudentClassCell({ name }: Readonly<{ name?: string | null }>) {
  return <span className="whitespace-nowrap">{name || "-"}</span>;
}

type Handlers = {
  onEdit: (student: Student) => void;
  onReset: (student: Student) => void;
  onMove: (student: StudentRow) => void;
};

function StudentActionsCell({
  student,
  canManage,
  onEdit,
  onMove,
  onReset,
}: Readonly<{ student: StudentRow; canManage: boolean } & Handlers>) {
  if (!canManage)
    return (
      <Link
        to="/students/$studentId"
        params={{ studentId: student.student_id }}
        className="btn btn-ghost btn-sm"
      >
        <Eye className="size-4" /> Detail
      </Link>
    );
  return (
    <ActionMenu>
      <li>
        <Link
          to="/students/$studentId"
          params={{ studentId: student.student_id }}
        >
          <Eye className="size-4" /> Detail
        </Link>
      </li>
      <li>
        <button
          type="button"
          onClick={() => onEdit(student)}
        >
          <Pencil className="size-4" /> Edit
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => onReset(student)}
        >
          <KeyRound className="size-4" /> Reset Akun
        </button>
      </li>
      <li className={isActive(student.is_active) ? undefined : "menu-disabled"}>
        <button
          type="button"
          disabled={!isActive(student.is_active)}
          onClick={() => onMove(student)}
        >
          <ArrowRightLeft className="size-4" /> Pindah Kelas
        </button>
      </li>
    </ActionMenu>
  );
}

function createStudentColumns({
  canManage,
  onEdit,
  onReset,
  onMove,
}: Readonly<Handlers & { canManage: boolean }>) {
  return col.columns([
    col.accessor("nis", {
      header: "NIS",
      cell: (i) => `${i.getValue() || "-"}`,
    }),
    col.accessor("nisn", {
      header: "NISN",
      cell: (i) => `${i.getValue() || "-"}`,
    }),
    col.accessor("full_name", {
      header: "Nama Lengkap",
      cell: (i) => (
        <StudentNameCell
          studentId={i.row.original.student_id}
          name={i.getValue()}
        />
      ),
    }),
    col.accessor("class_name", {
      header: "Kelas",
      cell: (i) => <StudentClassCell name={i.getValue()} />,
    }),
    col.accessor("gender", { header: "L/P" }),
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
        <StudentActionsCell
          student={row.original}
          onEdit={onEdit}
          onReset={onReset}
          onMove={onMove}
          canManage={canManage}
        />
      ),
    }),
  ]);
}

function StudentsPage() {
  const { me } = Route.useRouteContext();
  const { edit, back } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: students } = useSuspenseQuery(studentsQuery);
  const { data: studentClasses } = useSuspenseQuery(studentClassesQuery);
  const { data: classes } = useSuspenseQuery(classesQuery);
  const [moving, setMoving] = useState<StudentRow | null>(null);
  const [search, setSearch] = useState("");
  // Id siswa tujuan kembali, hanya terisi bila form Edit dibuka dari halaman detail
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    student: Student | null;
  }>({ open: false, student: null });
  const { confirm, dialog } = useConfirm();
  const isAdmin = me.role === "admin";

  // ?edit=<id> membuka form Edit siswa itu, baik saat halaman baru dibuka (dari halaman detail)
  // maupun saat parameternya berubah ketika halaman sudah terbuka. Disesuaikan saat render
  // (pola dokumentasi React), bukan setState di dalam efek.
  const [seenEdit, setSeenEdit] = useState<string | undefined>(undefined);
  if (edit !== seenEdit) {
    setSeenEdit(edit);
    const s = edit ? students.find((x) => x.student_id === edit) : undefined;
    if (s && isAdmin) {
      setModal({ open: true, student: s });
      setReturnTo(back ? s.student_id : null);
    }
  }

  // Hapus parameter dari URL agar refresh atau tombol kembali tidak membukanya lagi
  useEffect(() => {
    if (edit || back)
      void navigate({
        to: "/students",
        search: { edit: undefined, back: undefined },
        replace: true,
      });
  }, [edit, back, navigate]);

  // Dipanggil saat form ditutup atau selesai disimpan
  const backToDetail = () => {
    if (!returnTo) return;
    const id = returnTo;
    setReturnTo(null);
    void navigate({ to: "/students/$studentId", params: { studentId: id } });
  };

  const generate = useMutation({
    mutationFn: api.generateStudentAccounts,
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (id: string) => api.resetStudentAccount(id),
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  });

  // Handler terbaru lewat ref agar definisi kolom tetap stabil
  const resetAccount = reset.mutate; // stabil, berbeda dari objek `reset` yang baru tiap render

  const columns = useMemo(
    () =>
      createStudentColumns({
        canManage: isAdmin,
        onEdit: (student) => setModal({ open: true, student }),
        onReset: (student) => {
          void confirm(
            `Buat atau reset akun ${student.full_name}?\nUsername = NIS, password = NISN. Siswa diminta menggantinya saat login.`,
          ).then((confirmed) => {
            if (confirmed) resetAccount(student.student_id);
          });
        },
        onMove: (student) => setMoving(student),
      }),
    [confirm, resetAccount, isAdmin],
  );

  const rows = useMemo<StudentRow[]>(() => {
    const byId = new Map(classes.map((c) => [c.class_id, c]));
    const latest = new Map<string, StudentClass>();
    for (const h of studentClasses) {
      const prev = latest.get(h.student_id);
      if (!prev || h.start_date > prev.start_date) latest.set(h.student_id, h);
    }
    return students.map((s) => {
      const c = byId.get(latest.get(s.student_id)?.class_id ?? "");
      return {
        ...s,
        current_class_id: c?.class_id ?? "",
        class_name: c?.class_name ?? "",
        class_year: c?.academic_year ?? "",
      };
    });
  }, [students, classes, studentClasses]);

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.full_name} ${s.nis} ${s.nisn}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

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
      <PageHeader title={isAdmin ? "Master Data Siswa" : "Data Siswa"}>
        {isAdmin ? (
          <>
            <HeaderButton
              label="Buat Akun Siswa"
              className="btn-outline"
              icon={<KeyRound className="size-4" />}
              disabled={generate.isPending}
              onClick={async () => {
                if (
                  await confirm(
                    "Buat akun login untuk semua siswa aktif yang belum punya akun?\nUsername = NIS, password awal = NISN.",
                  )
                )
                  generate.mutate();
              }}
            />
            <HeaderButton
              label="Tambah Siswa"
              icon={<Plus className="size-4" />}
              onClick={() =>
                setModal({
                  open: true,
                  student: null,
                })
              }
            />
          </>
        ) : null}
      </PageHeader>

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
          emptyText={
            isAdmin
              ? "Tidak ada data siswa."
              : "Belum ada siswa di kelas yang Anda ampu."
          }
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => {
          setModal((m) => ({ ...m, open: false }));
          backToDetail();
        }}
        title={modal.student ? "Edit Siswa" : "Tambah Siswa"}
      >
        {modal.open ? (
          <StudentForm
            key={modal.student?.student_id ?? "new"}
            student={modal.student}
            onDone={() => {
              setModal({
                open: false,
                student: null,
              });
              void qc.invalidateQueries({
                queryKey: qk.students,
              });
              // Siswa baru langsung masuk kelas (riwayat kelas dibuat server)
              void qc.invalidateQueries({
                queryKey: qk.studentClasses,
              });
              void qc.invalidateQueries({
                queryKey: qk.dashboard,
              });
              backToDetail();
            }}
            onCancel={() => {
              setModal((m) => ({
                ...m,
                open: false,
              }));
              backToDetail();
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={moving !== null}
        onClose={() => setMoving(null)}
        title="Pindah Kelas"
      >
        {moving ? (
          <MoveStudentForm
            key={moving.student_id}
            student={moving}
            onDone={() => setMoving(null)}
            onCancel={() => setMoving(null)}
          />
        ) : null}
      </Modal>
      {dialog}
    </div>
  );
}

function StudentForm({
  student,
  onDone,
  onCancel,
}: Readonly<{
  student: Student | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: students } = useSuspenseQuery(studentsQuery);
  const activeClasses = useMemo(
    () => classes.filter((c) => isActive(c.is_active)),
    [classes],
  );
  const isNew = !student;

  // Aturan dibuat dari data terbaru: NIS/NISN ganda, kelas yang tersedia, mode tambah/edit
  const schema = useMemo(
    () =>
      makeStudentSchema({
        students,
        editingId: student?.student_id,
        classIds: activeClasses.map((c) => c.class_id),
      }),
    [students, student?.student_id, activeClasses],
  );

  const save = useMutation({
    mutationFn: (v: StudentInput) => api.saveStudent(v),
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      nis: student?.nis ?? "",
      nisn: student?.nisn ?? "",
      full_name: student?.full_name ?? "",
      gender: student?.gender || "L",
      class_id: "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      const payload: StudentInput = {
        student_id: student?.student_id ?? "",
        nis: value.nis.trim(),
        nisn: value.nisn.trim(),
        full_name: value.full_name.trim(),
        gender: value.gender,
      };
      if (isNew) payload.class_id = value.class_id;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="nis">
          {(f) => (
            <TextField
              label="NIS"
              field={f}
            />
          )}
        </form.Field>
        <form.Field name="nisn">
          {(f) => (
            <TextField
              label="NISN"
              field={f}
              inputMode="numeric"
              maxLength={10}
            />
          )}
        </form.Field>
      </div>

      <form.Field name="full_name">
        {(f) => (
          <TextField
            label="Nama Lengkap"
            field={f}
          />
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="gender">
          {(f) => (
            <RadioField
              label="Jenis Kelamin"
              field={f}
              options={[
                {
                  value: "L",
                  label: "Laki-laki",
                },
                {
                  value: "P",
                  label: "Perempuan",
                },
              ]}
            />
          )}
        </form.Field>

        {isNew ? (
          <form.Field name="class_id">
            {(f) => (
              <SelectField
                label="Kelas"
                field={f}
              >
                <option
                  disabled
                  value=""
                >
                  -- Pilih Kelas --
                </option>
                {activeClasses.map((c) => (
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
        ) : null}
      </div>

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

const moveSchema = z.object({
  class_id: z.string().min(1, "Pilih kelas tujuan"),
});

function MoveStudentForm({
  student,
  onDone,
  onCancel,
}: Readonly<{
  student: StudentRow;
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

  const move = useMutation({
    mutationFn: (classId: string) =>
      api.moveStudent(student.student_id, classId),
    onSuccess: async (r) => {
      toast.success(r.message);
      await Promise.all([
        qc.invalidateQueries({
          queryKey: qk.studentClasses,
        }),
        qc.invalidateQueries({
          queryKey: qk.attendance,
        }),
        qc.invalidateQueries({
          queryKey: qk.report,
        }),
        qc.invalidateQueries({
          queryKey: qk.dashboard,
        }),
      ]);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: { class_id: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: moveSchema },
    onSubmit: async ({ value }) => {
      await move.mutateAsync(value.class_id).catch(() => {});
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
        {student.class_name
          ? `${student.class_name} (${student.class_year || "-"})`
          : "- (belum punya kelas)"}
        .
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
      <ErrorAlert message={move.error?.message} />
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
          disabled={move.isPending}
        >
          {move.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : null}
          Pindahkan
        </button>
      </div>
    </form>
  );
}
