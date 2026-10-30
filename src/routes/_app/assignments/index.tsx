import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { allowRoles } from "~/lib/auth";
import { classesQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { tugas } from "~/lib/tugas-api";
import { assignmentsQuery, tk } from "~/lib/tugas-queries";
import { makeAssignmentSchema } from "~/lib/tugas-schema";
import type { Assignment } from "~/lib/tugas-types";
import { isActive, parseClassIds } from "~/lib/types";
import { firstMessage } from "~/lib/validation";
import {
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  SelectField,
  TextField,
  TextAreaField,
  useConfirm,
} from "~/components/ui";

export const Route = createFileRoute("/_app/assignments/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(assignmentsQuery),
      context.queryClient.query(classesQuery),
    ]),
  component: AssignmentsPage,
});

const col = columnHelperFor<Assignment>();
const fmtDue = (s: string) => (s ? s.replace("T", " ") : "-");
const published = (v: unknown) => v === true || v === "TRUE" || v === "true";

function AssignmentsPage() {
  const qc = useQueryClient();
  const { data: items } = useSuspenseQuery(assignmentsQuery);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{
    open: boolean;
    item: Assignment | null;
  }>({ open: false, item: null });
  const { confirm, dialog } = useConfirm();

  const remove = useMutation({
    mutationFn: (id: string) => tugas.deleteAssignment(id),
    onSuccess: (r) => {
      toast.success(r.message);
      void qc.invalidateQueries({ queryKey: tk.list });
    },
    onError: (e) => toast.error(e.message),
  });

  const actions = useRef({
    edit: (_a: Assignment) => {},
    remove: (_a: Assignment) => {},
  });
  actions.current = {
    edit: (a) => setModal({ open: true, item: a }),
    remove: async (a) => {
      const extra =
        a.started_count > 0
          ? `\n${a.started_count} siswa sudah mulai mengerjakan; jawaban dan nilai mereka ikut terhapus.`
          : "";
      if (
        await confirm(
          `Hapus tugas "${a.title}" beserta seluruh soalnya?${extra}`,
        )
      )
        remove.mutate(a.assignment_id);
    },
  };

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("title", {
          header: "Judul",
          cell: (i) => (
            <>
              <div className="font-medium">{i.getValue()}</div>
              {i.row.original.description ? (
                <div className="line-clamp-1 max-w-xs text-xs text-base-content/60">
                  {i.row.original.description}
                </div>
              ) : null}
            </>
          ),
        }),
        col.accessor("class_name", { header: "Kelas" }),
        col.accessor((r) => r.due_at, {
          id: "due",
          header: "Tenggat",
          cell: (i) => fmtDue(i.getValue()),
        }),
        col.accessor("question_count", { header: "Soal" }),
        col.accessor((r) => (published(r.is_published) ? "Terbit" : "Draft"), {
          id: "status",
          header: "Status",
          cell: (i) => (
            <span
              className={`badge badge-soft badge-sm ${i.getValue() === "Terbit" ? "badge-success" : "badge-ghost"}`}
            >
              {i.getValue()}
            </span>
          ),
        }),
        col.display({
          id: "subs",
          header: "Pengumpulan",
          enableSorting: false,
          cell: ({ row }) => (
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span>{row.original.submitted_count}</span>
              {row.original.pending_count > 0 ? (
                <span className="badge badge-warning badge-sm">
                  {row.original.pending_count} perlu dinilai
                </span>
              ) : null}
            </div>
          ),
        }),
        col.display({
          id: "actions",
          header: "Aksi",
          enableSorting: false,
          cell: ({ row }) => {
            const id = row.original.assignment_id;
            return (
              <div className="whitespace-nowrap">
                <Link
                  to="/assignments/$assignmentId/questions"
                  params={{ assignmentId: id }}
                  className="btn btn-ghost btn-xs text-primary"
                >
                  Soal
                </Link>
                <Link
                  to="/assignments/$assignmentId/submissions"
                  params={{ assignmentId: id }}
                  className="btn btn-ghost btn-xs text-primary"
                >
                  Pengumpulan
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-primary"
                  onClick={() => actions.current.edit(row.original)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => actions.current.remove(row.original)}
                >
                  Hapus
                </button>
              </div>
            );
          },
        }),
      ]),
    [],
  );

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter((a) =>
          `${a.title} ${a.class_name}`.toLowerCase().includes(q),
        )
      : items;
  }, [items, search]);

  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tugas</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setModal({ open: true, item: null })}
        >
          <Plus className="size-4" /> Buat Tugas
        </button>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              table.setPageIndex(0);
            }}
            placeholder="Cari judul atau kelas..."
          />
        </div>
        <DataTable table={table} emptyText="Belum ada tugas." />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.item ? "Edit Tugas" : "Buat Tugas"}
      >
        <AssignmentForm
          item={modal.item}
          onDone={() => {
            setModal({ open: false, item: null });
            void qc.invalidateQueries({ queryKey: tk.list });
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
      {dialog}
    </div>
  );
}

function AssignmentForm({
  item,
  onDone,
  onCancel,
}: Readonly<{
  item: Assignment | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const { me } = Route.useRouteContext();
  const { data: classes } = useSuspenseQuery(classesQuery);
  const isNew = !item;

  // Guru hanya boleh memilih kelas yang diampu
  const options = useMemo(() => {
    const mine = me.role === "guru" ? parseClassIds(me.assigned_classes) : null;
    return classes.filter(
      (c) =>
        (isActive(c.is_active) && (!mine || mine.includes(c.class_id))) ||
        c.class_id === item?.class_id,
    );
  }, [classes, me.role, me.assigned_classes, item?.class_id]);

  const questionCount = item?.question_count ?? 0;
  const schema = useMemo(
    () =>
      makeAssignmentSchema({
        classIds: options.map((c) => c.class_id),
        questionCount,
        isNew,
      }),
    [options, questionCount, isNew],
  );

  const save = useMutation({
    mutationFn: tugas.saveAssignment,
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      class_id: item?.class_id ?? "",
      due_at: item?.due_at ?? "",
      duration_minutes: String(item?.duration_minutes ?? 0),
      is_published: item ? published(item.is_published) : false,
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          assignment_id: item?.assignment_id ?? "",
          title: value.title.trim(),
          description: value.description.trim(),
          class_id: value.class_id,
          due_at: value.due_at,
          duration_minutes: Number(value.duration_minutes.trim() || 0),
          is_published: value.is_published,
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
      <form.Field name="title">
        {(f) => <TextField label="Judul Tugas" field={f} maxLength={150} />}
      </form.Field>
      <form.Field name="description">
        {(f) => (
          <TextAreaField label="Deskripsi / Petunjuk" field={f} rows={3} />
        )}
      </form.Field>

      <form.Field name="class_id">
        {(f) => (
          <SelectField
            label="Kelas"
            field={f}
            hint={
              item && item.started_count > 0
                ? "Kelas tidak dapat diubah karena sudah ada siswa yang mengerjakan."
                : undefined
            }
          >
            <option disabled selected value="">
              -- Pilih Kelas --
            </option>
            {options.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
              </option>
            ))}
          </SelectField>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="due_at">
          {(f) => (
            <TextField
              label="Tenggat (opsional)"
              field={f}
              type="datetime-local"
            />
          )}
        </form.Field>
        <form.Field name="duration_minutes">
          {(f) => (
            <TextField
              label="Durasi (menit)"
              field={f}
              inputMode="numeric"
              hint="0 = tanpa batas durasi"
            />
          )}
        </form.Field>
      </div>

      <form.Field name="is_published">
        {(f) => {
          const msg = f.state.meta.isTouched
            ? firstMessage(f.state.meta.errors)
            : "";
          return (
            <div className="pt-1">
              <label
                className={`flex items-center gap-2 text-sm ${questionCount === 0 ? "opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={f.state.value}
                  disabled={questionCount === 0}
                  onChange={(e) => f.handleChange(e.target.checked)}
                />
                <span>Publikasikan ke siswa</span>
              </label>
              {questionCount === 0 ? (
                <p className="label mt-1">
                  Tambahkan soal terlebih dahulu sebelum mempublikasikan.
                </p>
              ) : null}
              {msg ? (
                <p role="alert" className="mt-1 text-xs text-error">
                  {msg}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>

      <ErrorAlert message={save.error?.message} />

      <div className="modal-action">
        <button type="button" className="btn" onClick={onCancel}>
          Batal
        </button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button type="submit" className="btn btn-primary" disabled={busy}>
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
