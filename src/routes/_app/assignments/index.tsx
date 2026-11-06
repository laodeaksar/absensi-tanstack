import { useForm, useSelector } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import {
  Inbox,
  ListChecks,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";

import type { Assignment } from "~/lib/types";

import {
  PublishStatusIcon,
  PageHeader,
  HeaderButton,
} from "~/components/status-icons";
import {
  DataTable,
  ErrorAlert,
  Modal,
  Pager,
  SearchBox,
  SelectField,
  TextField,
  TextAreaField,
  CheckboxField,
  ActionMenu,
} from "~/components/ui";
import { LIMITS } from "~/convex/limits";
import { useConfirm } from "~/hooks/use-confirm";
import { api } from "~/lib/api";
import { makeAssignmentSchema } from "~/lib/assignment-schema";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import {
  classesQuery,
  assignmentsQuery,
  qk,
  settingsQuery,
  teachingQuery,
} from "~/lib/queries";
import { pairKey } from "~/lib/subject-attendance-schema";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { isActive } from "~/lib/types";

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

  const publish = useMutation({
    mutationFn: (v: { id: string; published: boolean }) =>
      api.setPublished(v.id, v.published),
    onSuccess: (r) => {
      toast.success(r.message);
      void qc.invalidateQueries({
        queryKey: qk.list,
      });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAssignment(id),
    onSuccess: (r) => {
      toast.success(r.message);
      void qc.invalidateQueries({
        queryKey: qk.list,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const actions = useRef({
    edit: (_a: Assignment) => {},
    remove: (_a: Assignment) => {},
    publish: (_a: Assignment) => {},
  });
  useLayoutEffect(() => {
    actions.current.publish = async (a) => {
      const unpublishing = published(a.is_published);
      // Menarik tugas yang sudah dikerjakan siswa perlu konfirmasi: tugas hilang dari daftar siswa
      if (
        unpublishing &&
        a.started_count > 0 &&
        !(await confirm(
          `Tarik tugas "${a.title}" ke draft?\n${a.started_count} siswa sudah mulai mengerjakan; tugas tidak lagi tampil di daftar siswa sampai diterbitkan kembali.`,
        ))
      )
        return;
      publish.mutate({
        id: a.assignment_id,
        published: !unpublishing,
      });
    };
    actions.current.edit = (a) => setModal({ open: true, item: a });
    actions.current.remove = async (a) => {
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
    };
  }, [confirm, remove, publish]);

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
        col.accessor("class_name", {
          header: "Kelas",
        }),
        col.accessor("subject_name", {
          header: "Mapel",
          cell: (i) =>
            i.getValue() || <span className="text-base-content/50">-</span>,
        }),
        col.accessor((r) => r.due_at, {
          id: "due",
          header: "Tenggat",
          cell: (i) => (
            <span className="whitespace-nowrap">
              {formatDateTime(i.getValue())}
            </span>
          ),
        }),
        col.accessor("question_count", {
          header: "Soal",
        }),
        col.accessor((r) => (published(r.is_published) ? "Terbit" : "Draft"), {
          id: "status",
          header: "Status",
          cell: (i) => (
            <PublishStatusIcon published={i.getValue() === "Terbit"} />
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
            const a = row.original;
            const id = a.assignment_id;
            const isPub = published(a.is_published);
            const cannotPublish = !isPub && a.question_count === 0;
            return (
              <ActionMenu>
                <li>
                  <Link
                    to="/assignments/$assignmentId/questions"
                    params={{ assignmentId: id }}
                  >
                    <ListChecks className="size-4" /> Soal
                  </Link>
                </li>
                <li>
                  <Link
                    to="/assignments/$assignmentId/submissions"
                    params={{ assignmentId: id }}
                  >
                    <Inbox className="size-4" /> Pengumpulan
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={cannotPublish}
                    title={cannotPublish ? "Tambahkan soal dulu" : undefined}
                    onClick={() => actions.current.publish(a)}
                  >
                    {isPub ? (
                      <Undo2 className="size-4" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {isPub ? "Tarik ke Draft" : "Terbitkan"}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => actions.current.edit(row.original)}
                  >
                    <Pencil className="size-4" /> Edit
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
          `${a.title} ${a.class_name} ${a.subject_name}`
            .toLowerCase()
            .includes(q),
        )
      : items;
  }, [items, search]);

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
      <PageHeader title="Tugas">
        <HeaderButton
          label="Buat Tugas"
          icon={<Plus className="size-4" />}
          onClick={() => setModal({ open: true, item: null })}
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
            placeholder="Cari judul atau kelas..."
          />
        </div>
        <DataTable
          table={table}
          emptyText="Belum ada tugas."
        />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.item ? "Edit Tugas" : "Buat Tugas"}
      >
        {modal.open ? (
          <AssignmentForm
            key={modal.item?.assignment_id ?? "new"}
            item={modal.item}
            onDone={() => {
              setModal({ open: false, item: null });
              void qc.invalidateQueries({
                queryKey: qk.list,
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
  const { data: settings } = useSuspenseQuery(settingsQuery);
  // Guru: pengampu miliknya. Admin: semua pengampu yang terdaftar.
  const { data: teaching } = useSuspenseQuery(teachingQuery);
  const isNew = !item;
  // Tenggat harus di masa depan menurut zona waktu sekolah (sama dengan server), bukan jam perangkat
  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  // Guru boleh memilih kelas yang diampu (wali/penugasan kelas) dan kelas tempat ia mengampu mapel
  const options = useMemo(() => {
    const mine =
      me.role === "guru"
        ? new Set([...me.assigned_classes, ...teaching.map((t) => t.class_id)])
        : null;
    return classes.filter(
      (c) =>
        (isActive(c.is_active) && (!mine || mine.has(c.class_id))) ||
        c.class_id === item?.class_id,
    );
  }, [classes, me.role, me.assigned_classes, teaching, item?.class_id]);

  // Pasangan kelas + mapel yang boleh dipilih; pasangan tugas ini saat ini tetap tersedia saat edit
  const subjectChoices = useMemo(() => {
    const rows = teaching
      .filter((t) => t.subject_active)
      .map((t) => ({
        classId: t.class_id,
        id: t.subject_id,
        label: `${t.subject_code} - ${t.subject_name}`,
      }));
    if (
      item?.subject_id &&
      !rows.some((r) => r.classId === item.class_id && r.id === item.subject_id)
    )
      rows.push({
        classId: item.class_id,
        id: item.subject_id,
        label: item.subject_name,
      });
    return rows;
  }, [teaching, item?.class_id, item?.subject_id, item?.subject_name]);

  const questionCount = item?.question_count ?? 0;
  const schema = useMemo(
    () =>
      makeAssignmentSchema({
        classIds: options.map((c) => c.class_id),
        questionCount,
        isNew,
        tzOffsetMinutes: tz,
        subjectPairs: subjectChoices.map((r) => pairKey(r.classId, r.id)),
      }),
    [options, questionCount, isNew, tz, subjectChoices],
  );

  const save = useMutation({
    mutationFn: api.saveAssignment,
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
      subject_id: item?.subject_id ?? "",
      due_at: item?.due_at ?? "",
      duration_minutes: String(item?.duration_minutes ?? 0),
      is_published: item ? published(item.is_published) : false,
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
          assignment_id: item?.assignment_id ?? "",
          title: value.title.trim(),
          description: value.description.trim(),
          class_id: value.class_id,
          subject_id: value.subject_id,
          due_at: value.due_at,
          duration_minutes: Number(value.duration_minutes.trim() || 0),
          is_published: value.is_published,
        })
        .catch(() => {});
    },
  });

  // Pilihan mapel mengikuti kelas; bila kelas diganti dan mapel tidak berlaku di kelas baru, kosongkan
  const classId = useSelector(form.store, (st) => st.values.class_id);
  const choicesForClass = useMemo(
    () => subjectChoices.filter((r) => r.classId === classId),
    [subjectChoices, classId],
  );
  useEffect(() => {
    const cur = form.state.values.subject_id;
    if (cur && !choicesForClass.some((r) => r.id === cur))
      form.setFieldValue("subject_id", "");
  }, [choicesForClass, form]);

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
        {(f) => (
          <TextField
            label="Judul Tugas"
            field={f}
            maxLength={LIMITS.title}
          />
        )}
      </form.Field>
      <form.Field name="description">
        {(f) => (
          <TextAreaField
            label="Deskripsi / Petunjuk"
            field={f}
            rows={3}
          />
        )}
      </form.Field>

      {item && item.started_count > 0 ? (
        // Server menolak pergantian kelas bila sudah ada pengerjaan, jadi ditampilkan sebagai teks saja
        <div className="space-y-1">
          <div className="text-sm font-medium">Kelas</div>
          <div className="border-base-300 bg-base-200 rounded-lg border px-3 py-2 text-sm">
            {item.class_name}
          </div>
          <p className="text-base-content/60 text-xs">
            Kelas tidak dapat diubah karena sudah ada siswa yang mengerjakan.
          </p>
        </div>
      ) : (
        <form.Field name="class_id">
          {(f) => (
            <SelectField label="Kelas" field={f}>
              <option disabled value="">-- Pilih Kelas --</option>
              {options.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name}
                </option>
              ))}
            </SelectField>
          )}
        </form.Field>
      )}
      <form.Field name="subject_id">
        {(f) => (
          <SelectField
            label="Mata Pelajaran"
            field={f}
          >
            <option value="">-- Tanpa Mata Pelajaran --</option>
            {choicesForClass.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </SelectField>
        )}
      </form.Field>
      {options.length === 0 ? (
        <p className="text-warning text-sm">
          {me.role === "guru"
            ? "Anda belum mengampu kelas aktif. Hubungi admin untuk menambahkan kelas."
            : "Belum ada kelas aktif. Tambahkan kelas terlebih dahulu."}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        {(f) => (
          <CheckboxField
            label="Publikasikan ke siswa"
            field={f}
            disabled={questionCount === 0}
            hint={
              questionCount === 0
                ? "Tambahkan soal terlebih dahulu sebelum mempublikasikan."
                : undefined
            }
          />
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
