import { useForm, revalidateLogic } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { TeachingRow } from "~/lib/types";

import { HeaderButton, PageHeader } from "~/components/status-icons";
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
  subjectsQuery,
  teachersQuery,
  teachingQuery,
} from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { makeTeachingSchema } from "~/lib/teaching-schema";
import { toast } from "~/lib/toast";
import { isActive, Teacher } from "~/lib/types";

export const Route = createFileRoute("/_app/teaching")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(teachingQuery),
      context.queryClient.query(classesQuery),
      context.queryClient.query(subjectsQuery),
      context.queryClient.query(teachersQuery),
    ]),
  component: TeachingPage,
});

const col = columnHelperFor<TeachingRow>();

function TeachingClassCell({ teaching }: Readonly<{ teaching: TeachingRow }>) {
  return (
    <span className="font-medium">
      {teaching.class_name}
      <Inactive show={!teaching.class_active} />
    </span>
  );
}

function TeachingSubjectCell({
  teaching,
}: Readonly<{ teaching: TeachingRow }>) {
  return (
    <span>
      <span className="font-mono text-xs text-base-content/60">
        {teaching.subject_code}
      </span>{" "}
      {teaching.subject_name}
      <Inactive show={!teaching.subject_active} />
    </span>
  );
}

function TeachingTeacherCell({
  teaching,
}: Readonly<{ teaching: TeachingRow }>) {
  return (
    <span>
      {teaching.teacher_name}
      <Inactive show={!teaching.teacher_active} />
    </span>
  );
}

type Handlers = {
  onEdit: (teaching: TeachingRow) => void;
  onRemove: (teaching: TeachingRow) => void;
};

function TeachingActionsCell({
  teaching,
  onEdit,
  onRemove,
}: Readonly<{ teaching: TeachingRow } & Handlers>) {
  return (
    <ActionMenu>
      <li>
        <button
          type="button"
          onClick={() => onEdit(teaching)}
        >
          <Pencil className="size-4" /> Ganti Guru
        </button>
      </li>
      <li>
        <button
          type="button"
          className="text-error"
          onClick={() => onRemove(teaching)}
        >
          <Trash2 className="size-4" /> Hapus
        </button>
      </li>
    </ActionMenu>
  );
}

function createTeachingColumns({ onEdit, onRemove }: Readonly<Handlers>) {
  return col.columns([
    col.accessor("class_name", {
      header: "Kelas",
      cell: ({ row }) => <TeachingClassCell teaching={row.original} />,
    }),
    col.accessor("subject_name", {
      header: "Mata Pelajaran",
      cell: ({ row }) => <TeachingSubjectCell teaching={row.original} />,
    }),
    col.accessor("teacher_name", {
      header: "Guru Pengampu",
      cell: ({ row }) => <TeachingTeacherCell teaching={row.original} />,
    }),
    col.display({
      id: "actions",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <TeachingActionsCell
          teaching={row.original}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ),
    }),
  ]);
}

/** Tanda kecil bila kelas, mapel, atau guru pada baris ini sudah nonaktif. */
function Inactive({ show }: Readonly<{ show: boolean }>) {
  return show ? (
    <span className="badge badge-warning badge-sm ml-2">nonaktif</span>
  ) : null;
}

function TeachingPage() {
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery(teachingQuery);
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    row: TeachingRow | null;
  }>({ open: false, row: null });

  // Daftar tugas guru ikut berubah bila pengampu berubah
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.teaching });
    void qc.invalidateQueries({ queryKey: qk.list });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTeaching(id),
    onSuccess: (r) => {
      toast.success(r.message);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTeaching = remove.mutate; // stabil, berbeda dari objek `remove` yang baru tiap render

  const columns = useMemo(
    () =>
      createTeachingColumns({
        onEdit: (teaching) => setModal({ open: true, row: teaching }),
        onRemove: (teaching) => {
          void confirm(
            `Hapus pengampu ${teaching.subject_name} di ${teaching.class_name} (${teaching.teacher_name})?\nGuru tidak lagi dapat mengelola tugas dan absensi mapel ini di kelas tersebut.`,
          ).then((confirmed) => {
            if (confirmed) removeTeaching(teaching.teaching_id);
          });
        },
      }),
    [confirm, removeTeaching],
  );

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        `${r.class_name} ${r.subject_code} ${r.subject_name} ${r.teacher_name}`
          .toLowerCase()
          .includes(q),
    );
  }, [rows, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Pengampu Mata Pelajaran">
        <HeaderButton
          label="Tambah Pengampu"
          icon={<Plus className="size-4" />}
          onClick={() => setModal({ open: true, row: null })}
        />
      </PageHeader>

      <p className="text-sm text-base-content/70">
        Tentukan guru yang mengampu tiap mata pelajaran di tiap kelas. Hanya
        guru pengampu (dan admin) yang dapat membuat tugas dan mengisi absensi
        untuk mapel tersebut.
      </p>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              table.setPageIndex(0);
            }}
            placeholder="Cari kelas, mapel, atau guru..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Belum ada guru pengampu."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.row ? "Ganti Guru Pengampu" : "Tambah Pengampu"}
      >
        {modal.open ? (
          <TeachingForm
            key={modal.row?.teaching_id ?? "new"}
            row={modal.row}
            onDone={() => {
              setModal({ open: false, row: null });
              refresh();
            }}
            onCancel={() => setModal((m) => ({ ...m, open: false }))}
          />
        ) : null}
      </Modal>
      {dialog}
    </div>
  );
}

function TeachingForm({
  row,
  onDone,
  onCancel,
}: Readonly<{
  row: TeachingRow | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { data: rows } = useSuspenseQuery(teachingQuery);
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const { data: teachers } = useSuspenseQuery(teachersQuery);

  // Pilihan aktif; pada edit, nilai saat ini tetap tersedia walau sudah nonaktif
  const classOptions = useMemo(
    () =>
      classes.filter(
        (c) => isActive(c.is_active) || c.class_id === row?.class_id,
      ),
    [classes, row?.class_id],
  );
  const subjectOptions = useMemo(
    () =>
      subjects.filter((s) => s.is_active || s.subject_id === row?.subject_id),
    [subjects, row?.subject_id],
  );
  const teacherOptions = useMemo(
    () =>
      teachers.filter(
        (t) => isActive(t.is_active) || t.user_id === row?.teacher_id,
      ),
    [teachers, row?.teacher_id],
  );

  // Guru yang mengampu kelas itu (isian "Kelas yang diampu" di data guru). Pada edit, guru yang
  // sedang bertugas tetap tersedia walau kelasnya tidak lagi tercantum di sana.
  const teachersFor = (classId: string) =>
    classId
      ? teacherOptions.filter(
          (t) =>
            t.assigned_classes.includes(classId) ||
            t.user_id === row?.teacher_id,
        )
      : [];
  // Penugasan baru dengan hanya satu guru yang cocok: langsung terisi
  const onlyTeacherFor = (classId: string) => {
    const list = teachersFor(classId);
    return !row && list.length === 1 ? list[0]!.user_id : "";
  };

  const schema = useMemo(
    () =>
      makeTeachingSchema({
        rows,
        editingId: row?.teaching_id,
        classIds: classOptions.map((c) => c.class_id),
        subjectIds: subjectOptions.map((s) => s.subject_id),
        teacherIds: teacherOptions.map((t) => t.user_id),
      }),
    [rows, row?.teaching_id, classOptions, subjectOptions, teacherOptions],
  );

  const save = useMutation({
    mutationFn: (v: {
      teaching_id: string;
      class_id: string;
      subject_id: string;
      teacher_id: string;
    }) => api.saveTeaching(v),
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      class_id: row?.class_id ?? "",
      subject_id: row?.subject_id ?? "",
      teacher_id: row?.teacher_id ?? "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({ teaching_id: row?.teaching_id ?? "", ...value })
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
      {row ? (
        // Server tidak mengizinkan kelas/mapel diubah (tugas dan absensi terikat pada pasangan ini)
        <div className="space-y-1">
          <div className="text-sm font-medium">Kelas dan Mata Pelajaran</div>
          <div className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm">
            {row.class_name} · {row.subject_name}
          </div>
          <p className="text-xs text-base-content/60">
            Tidak dapat diubah. Hapus lalu buat pengampu baru bila perlu.
          </p>
        </div>
      ) : (
        <>
          <form.Field
            name="class_id"
            listeners={{
              // Guru bergantung pada kelas: pilihan lama tidak berlaku lagi,
              // dan bila hanya satu guru yang cocok, langsung terisi
              onChange: ({ fieldApi }) =>
                fieldApi.form.setFieldValue(
                  "teacher_id",
                  onlyTeacherFor(fieldApi.state.value),
                  { dontValidate: true },
                ),
            }}
          >
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
                {classOptions.map((c) => (
                  <option
                    key={c.class_id}
                    value={c.class_id}
                  >
                    {c.class_name}
                  </option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <form.Field name="subject_id">
            {(f) => (
              <SelectField
                label="Mata Pelajaran"
                field={f}
              >
                <option
                  disabled
                  value=""
                >
                  -- Pilih Mata Pelajaran --
                </option>
                {subjectOptions.map((s) => (
                  <option
                    key={s.subject_id}
                    value={s.subject_id}
                  >
                    {s.code} - {s.name}
                  </option>
                ))}
              </SelectField>
            )}
          </form.Field>
        </>
      )}

      <form.Subscribe selector={(st) => st.values.class_id}>
        {(classId) => {
          const list = teachersFor(classId);
          return (
            <>
              <form.Field name="teacher_id">
                {(f) => (
                  <SelectField
                    label="Guru Pengampu"
                    field={f}
                  >
                    <option
                      disabled
                      value=""
                    >
                      {classId ? "-- Pilih Guru --" : "-- Pilih kelas dulu --"}
                    </option>
                    {list.map((t) => (
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
              {classId && list.length === 0 ? (
                <NoTeacherHelp
                  classId={classId}
                  candidates={teacherOptions.filter(
                    (t) => !t.assigned_classes.includes(classId),
                  )}
                  onAssigned={(id) => form.setFieldValue("teacher_id", id)}
                />
              ) : null}
            </>
          );
        }}
      </form.Subscribe>

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

function NoTeacherHelp({
  classId,
  candidates,
  onAssigned,
}: Readonly<{
  classId: string;
  candidates: Teacher[];
  onAssigned: (teacherId: string) => void;
}>) {
  const [pick, setPick] = useState("");
  const assign = useMutation({
    mutationFn: () => {
      const t = candidates.find((x) => x.user_id === pick);
      if (!t) throw new Error("Pilih guru terlebih dahulu.");
      return api.saveTeacher({
        user_id: t.user_id,
        assigned_classes: [...t.assigned_classes, classId],
      });
    },
    onSuccess: () => {
      toast.success("Guru ditambahkan ke kelas ini.");
      onAssigned(pick);
      setPick("");
    },
  });

  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p>Belum ada guru yang mengampu kelas ini.</p>
      {candidates.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select select-bordered select-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">-- Pilih guru --</option>
            {candidates.map((t) => (
              <option
                key={t.user_id}
                value={t.user_id}
              >
                {t.full_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!pick || assign.isPending}
            onClick={() => assign.mutate()}
          >
            {assign.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Tambahkan ke kelas ini
          </button>
        </div>
      ) : null}
      <Link
        to="/teachers"
        search={{ add: classId, edit: undefined, back: undefined }}
        className="btn btn-sm btn-outline"
      >
        + Tambah guru baru
      </Link>
      <ErrorAlert message={assign.error?.message} />
    </div>
  );
}
