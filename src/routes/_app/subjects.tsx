import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Subject, SubjectInput } from "~/lib/types";

import { HeaderButton, PageHeader } from "~/components/status-icons";
import {
  ActionMenu,
  ActiveStatusIcon,
  CheckboxField,
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  TextField,
} from "~/components/ui";
import { LIMITS } from "~/convex/limits";
import { useConfirm } from "~/hooks/use-confirm";
import { api } from "~/lib/api";
import { allowRoles } from "~/lib/auth";
import { qk, subjectsQuery } from "~/lib/queries";
import { makeSubjectSchema } from "~/lib/subject-schema";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";

export const Route = createFileRoute("/_app/subjects")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  loader: ({ context }) => context.queryClient.query(subjectsQuery),
  component: SubjectsPage,
});

const col = columnHelperFor<Subject>();

function SubjectsPage() {
  const qc = useQueryClient();
  const { data: subjects } = useSuspenseQuery(subjectsQuery);
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    subject: Subject | null;
  }>({ open: false, subject: null });

  // Pengampu dan form tugas ikut memakai daftar mapel, jadi dimuat ulang bersama
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.subjects });
    void qc.invalidateQueries({ queryKey: qk.teaching });
  };

  const toggle = useMutation({
    mutationFn: (s: Subject) =>
      api.saveSubject({ subject_id: s.subject_id, is_active: !s.is_active }),
    onSuccess: (r) => {
      toast.success(r.message);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSubject(id),
    onSuccess: (r) => {
      toast.success(r.message);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const actions = useRef({
    edit: (_s: Subject) => {},
    toggle: (_s: Subject) => {},
    remove: (_s: Subject) => {},
  });
  useLayoutEffect(() => {
    actions.current.edit = (s) => setModal({ open: true, subject: s });
    actions.current.toggle = async (s) => {
      const message = s.is_active
        ? `Nonaktifkan mata pelajaran "${s.name}"?\nTidak muncul lagi di pilihan baru; pengampu, tugas, dan absensi yang sudah ada tetap tersimpan.`
        : `Aktifkan kembali mata pelajaran "${s.name}"?`;
      if (await confirm(message)) toggle.mutate(s);
    };
    actions.current.remove = async (s) => {
      if (
        await confirm(
          `Hapus mata pelajaran "${s.name}"?\nHanya bisa bila belum dipakai pengampu, tugas, atau absensi.`,
        )
      )
        remove.mutate(s.subject_id);
    };
  }, [confirm, toggle, remove]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("code", {
          header: "Kode",
          cell: (i) => <span className="font-mono text-sm">{i.getValue()}</span>,
        }),
        col.accessor("name", {
          header: "Mata Pelajaran",
          cell: (i) => <span className="font-medium">{i.getValue()}</span>,
        }),
        col.accessor((r) => (r.is_active ? "Aktif" : "Nonaktif"), {
          id: "status",
          header: "Status",
          cell: (i) => <ActiveStatusIcon active={i.getValue() === "Aktif"} />,
        }),
        col.display({
          id: "actions",
          header: "Aksi",
          enableSorting: false,
          cell: ({ row }) => {
            const s = row.original;
            return (
              <ActionMenu>
                <li>
                  <button
                    type="button"
                    onClick={() => actions.current.edit(s)}
                  >
                    <Pencil className="size-4" /> Edit
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => actions.current.toggle(s)}
                  >
                    {s.is_active ? (
                      <PowerOff className="size-4" />
                    ) : (
                      <Power className="size-4" />
                    )}
                    {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => actions.current.remove(s)}
                  >
                    <Trash2 className="size-4" /> Hapus
                  </button>
                </li>
              </ActionMenu>
            );
          },
        }),
      ]),
    [],
  );

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects.filter(
      (s) => !q || `${s.code} ${s.name}`.toLowerCase().includes(q),
    );
  }, [subjects, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Mata Pelajaran">
        <HeaderButton
          label="Tambah Mapel"
          icon={<Plus className="size-4" />}
          onClick={() => setModal({ open: true, subject: null })}
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
            placeholder="Cari kode atau nama..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Belum ada mata pelajaran."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.subject ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
      >
        {modal.open ? (
          <SubjectForm
            key={modal.subject?.subject_id ?? "new"}
            subject={modal.subject}
            onDone={() => {
              setModal({ open: false, subject: null });
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

function SubjectForm({
  subject,
  onDone,
  onCancel,
}: Readonly<{
  subject: Subject | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { data: subjects } = useSuspenseQuery(subjectsQuery);

  // Aturan dibuat dari data terbaru, jadi cek duplikat selalu sesuai isi daftar
  const schema = useMemo(
    () => makeSubjectSchema({ subjects, editingId: subject?.subject_id }),
    [subjects, subject?.subject_id],
  );

  const save = useMutation({
    mutationFn: (v: SubjectInput) => api.saveSubject(v),
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      code: subject?.code ?? "",
      name: subject?.name ?? "",
      is_active: subject?.is_active ?? true,
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          subject_id: subject?.subject_id ?? "",
          code: value.code.trim().toUpperCase(),
          name: value.name.trim(),
          // Mapel baru selalu aktif; status hanya diubah saat edit
          ...(subject ? { is_active: value.is_active } : {}),
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
      <form.Field name="code">
        {(f) => (
          <TextField
            label="Kode"
            field={f}
            placeholder="Misal: MTK"
            maxLength={LIMITS.subjectCodeMax}
            autoComplete="off"
            hint="Huruf besar otomatis. Dipakai sebagai singkatan di tabel."
          />
        )}
      </form.Field>
      <form.Field name="name">
        {(f) => (
          <TextField
            label="Nama Mata Pelajaran"
            field={f}
            placeholder="Misal: Matematika"
            maxLength={LIMITS.subjectName}
          />
        )}
      </form.Field>
      {subject ? (
        <form.Field name="is_active">
          {(f) => (
            <CheckboxField
              label="Mata pelajaran aktif"
              field={f}
              hint="Nonaktif: tidak muncul di pilihan pengampu, tugas, dan absensi baru."
            />
          )}
        </form.Field>
      ) : null}

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