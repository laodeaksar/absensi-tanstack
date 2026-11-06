import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

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
import { isActive } from "~/lib/types";

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

  const actions = useRef({
    edit: (_r: TeachingRow) => {},
    remove: (_r: TeachingRow) => {},
  });
  useLayoutEffect(() => {
    actions.current.edit = (r) => setModal({ open: true, row: r });
    actions.current.remove = async (r) => {
      if (
        await confirm(
          `Hapus pengampu ${r.subject_name} di ${r.class_name} (${r.teacher_name})?\nGuru tidak lagi dapat mengelola tugas dan absensi mapel ini di kelas tersebut.`,
        )
      )
        remove.mutate(r.teaching_id);
    };
  }, [confirm, remove]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("class_name", {
          header: "Kelas",
          cell: (i) => (
            <span className="font-medium">
              {i.getValue()}
              <Inactive show={!i.row.original.class_active} />
            </span>
          ),
        }),
        col.accessor("subject_name", {
          header: "Mata Pelajaran",
          cell: (i) => (
            <span>
              <span className="font-mono text-xs text-base-content/60">
                {i.row.original.subject_code}
              </span>{" "}
              {i.getValue()}
              <Inactive show={!i.row.original.subject_active} />
            </span>
          ),
        }),
        col.accessor("teacher_name", {
          header: "Guru Pengampu",
          cell: (i) => (
            <span>
              {i.getValue()}
              <Inactive show={!i.row.original.teacher_active} />
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
                <button
                  type="button"
                  onClick={() => actions.current.edit(row.original)}
                >
                  <Pencil className="size-4" /> Ganti Guru
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="text-error"
                  onClick={() => actions.current.remove(row.original)}
                >
                  <Trash2 className="size-4" /> Hapus
                </button>
              </li>
            </ActionMenu>
          ),
        }),
      ]),
    [],
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
    validators: { onChange: schema, onSubmit: schema },
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
              -- Pilih Guru --
            </option>
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