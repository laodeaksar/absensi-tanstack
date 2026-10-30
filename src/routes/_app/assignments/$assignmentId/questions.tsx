import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useTable } from "@tanstack/react-table";
import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react";
import { allowRoles } from "~/lib/auth";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { tugas } from "~/lib/tugas-api";
import { assignmentDetailQuery, tk } from "~/lib/tugas-queries";
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  letter,
  makeQuestionSchema,
} from "~/lib/tugas-schema";
import type { Question, QuestionInput } from "~/lib/tugas-types";
import { firstMessage } from "~/lib/validation";
import {
  DataTable,
  ErrorAlert,
  Modal,
  SelectField,
  TextField,
  TextAreaField,
  useConfirm,
} from "~/components/ui";

export const Route = createFileRoute(
  "/_app/assignments/$assignmentId/questions",
)({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context, params }) =>
    context.queryClient.query(
      assignmentDetailQuery(params.assignmentId),
    ),
  component: QuestionsPage,
});

const col = columnHelperFor<Question>();

function QuestionTextCell({ question }: Readonly<{ question: Question }>) {
  return (
    <div className="min-w-60 max-w-xl">
      <p className="whitespace-pre-line font-medium">{question.text}</p>
      {question.type === "pilihan_ganda" ? (
        <ol className="mt-1 list-[upper-alpha] pl-5 text-sm">
          {question.options.map((option, index) => (
            <li
              key={`${question.question_id}-${option}`}
              className={index === Number(question.correct_index) ? "font-semibold text-success" : ""}
            >
              {option}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-xs text-base-content/60">Dinilai manual oleh guru/admin.</p>
      )}
    </div>
  );
}

function QuestionTypeCell({ type }: Readonly<{ type: Question["type"] }>) {
  return (
    <span className={`badge badge-soft badge-sm ${type === "esai" ? "badge-warning" : "badge-info"}`}>
      {type === "esai" ? "Esai" : "Pilihan ganda"}
    </span>
  );
}

function QuestionActionsCell({
  question,
  locked,
  onEdit,
  onRemove,
}: Readonly<{ question: Question; locked: boolean; onEdit: (question: Question) => void; onRemove: (question: Question) => void }>) {
  return (
    <div className="whitespace-nowrap">
      <button type="button" className="btn btn-ghost btn-xs text-primary" disabled={locked} onClick={() => onEdit(question)}>
        Edit
      </button>
      <button type="button" className="btn btn-ghost btn-xs text-error" disabled={locked} onClick={() => onRemove(question)}>
        Hapus
      </button>
    </div>
  );
}

function createQuestionColumns({
  locked,
  onEdit,
  onRemove,
}: Readonly<{ locked: boolean; onEdit: (question: Question) => void; onRemove: (question: Question) => void }>) {
  return col.columns([
    col.display({ id: "no", header: "No", cell: ({ row }) => row.index + 1 }),
    col.display({ id: "q", header: "Soal", cell: ({ row }) => <QuestionTextCell question={row.original} /> }),
    col.display({ id: "type", header: "Tipe", cell: ({ row }) => <QuestionTypeCell type={row.original.type} /> }),
    col.accessor("points", { header: "Poin", enableSorting: false }),
    col.display({
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => <QuestionActionsCell question={row.original} locked={locked} onEdit={onEdit} onRemove={onRemove} />,
    }),
  ]);
}

function CorrectOptionRadio({ index, checked, onSelect }: Readonly<{ index: number; checked: boolean; onSelect: (value: string) => void }>) {
  return (
    <input
      type="radio"
      name="correct"
      className="radio radio-primary radio-sm mt-9"
      aria-label={`Jawaban benar: pilihan ${letter(index)}`}
      checked={checked}
      onChange={() => onSelect(String(index))}
    />
  );
}

function QuestionsPage() {
  const { assignmentId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(assignmentDetailQuery(assignmentId));
  const { assignment, questions, locked, max_score } = data;
  const [modal, setModal] = useState<{
    open: boolean;
    question: Question | null;
  }>({ open: false, question: null });
  const { confirm, dialog } = useConfirm();

  const refresh = () => {
    void Promise.all([
      qc.invalidateQueries({ queryKey: tk.detail(assignmentId) }),
      qc.invalidateQueries({ queryKey: tk.list }),
    ]);
  };

  const remove = useMutation({
    mutationFn: (id: string) => tugas.deleteQuestion(id),
    onSuccess: (r) => {
      toast.success(r.message);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });



  const columns = useMemo(
    () => createQuestionColumns({
      locked,
      onEdit: (question) => setModal({ open: true, question }),
      onRemove: (question) => {
        void confirm("Hapus soal ini?").then((confirmed) => {
          if (confirmed) remove.mutate(question.question_id);
        });
      },
    }),
    [locked, confirm, remove],
  );

  const table = useTable({
    features,
    columns,
    data: questions,
    initialState: { pagination: { pageIndex: 0, pageSize: 1000 } },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/assignments" className="btn btn-ghost btn-xs mb-1 -ml-2">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold">{assignment.title}</h2>
            <p className="text-sm text-base-content/60">
              Kelas {assignment.class_name} - {questions.length} soal - total{" "}
              {max_score} poin
              {assignment.is_published === true ||
              assignment.is_published === "TRUE"
                ? " - Terbit"
                : " - Draft"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/assignments/$assignmentId/submissions"
              params={{ assignmentId }}
              className="btn btn-outline btn-sm"
            >
              Pengumpulan
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={locked}
              onClick={() => setModal({ open: true, question: null })}
            >
              <Plus className="size-4" /> Tambah Soal
            </button>
          </div>
        </div>
      </div>

      {locked ? (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          <Lock className="size-4 shrink-0" />
          <span>
            Sudah ada siswa yang mengerjakan, jadi soal terkunci (tidak bisa
            ditambah, diubah, atau dihapus).
          </span>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable
          table={table}
          emptyText="Belum ada soal. Klik Tambah Soal."
        />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.question ? "Edit Soal" : "Tambah Soal"}
      >
        <QuestionForm
          assignmentId={assignmentId}
          question={modal.question}
          onDone={() => {
            setModal({ open: false, question: null });
            refresh();
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
      {dialog}
    </div>
  );
}

function QuestionForm({
  assignmentId,
  question,
  onDone,
  onCancel,
}: Readonly<{
  assignmentId: string;
  question: Question | null;
  onDone: () => void;
  onCancel: () => void;
}>) {
  const schema = useMemo(() => makeQuestionSchema(), []);

  const save = useMutation({
    mutationFn: (v: QuestionInput) => tugas.saveQuestion(v),
    onSuccess: (r) => {
      toast.success(r.message);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      type: question?.type ?? "pilihan_ganda",
      text: question?.text ?? "",
      options:
        question && question.options.length > 0
          ? question.options
          : ["", "", "", ""],
      correct_index:
        question && question.correct_index !== ""
          ? String(question.correct_index)
          : "",
      points: String(question?.points ?? 10),
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      const isMcq = value.type === "pilihan_ganda";
      await save
        .mutateAsync({
          question_id: question?.question_id ?? "",
          assignment_id: assignmentId,
          type: value.type as QuestionInput["type"],
          text: value.text.trim(),
          options: isMcq ? value.options.map((o) => o.trim()) : [],
          correct_index: isMcq ? Number(value.correct_index) : "",
          points: Number(value.points),
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
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <form.Field name="type">
            {(f) => (
              <SelectField label="Tipe Soal" field={f}>
                <option value="pilihan_ganda">Pilihan ganda</option>
                <option value="esai">Esai</option>
              </SelectField>
            )}
          </form.Field>
        </div>
        <form.Field name="points">
          {(f) => <TextField label="Poin" field={f} inputMode="numeric" />}
        </form.Field>
      </div>

      <form.Field name="text">
        {(f) => (
          <TextAreaField
            label="Pertanyaan"
            field={f}
            rows={4}
            maxLength={2100}
          />
        )}
      </form.Field>

      {/* Bagian pilihan hanya untuk pilihan ganda */}
      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type === "pilihan_ganda" ? (
            <form.Field name="options" mode="array">
              {(opts) => {
                const count = opts.state.value.length;
                const listMsg = opts.state.meta.isTouched
                  ? firstMessage(opts.state.meta.errors)
                  : "";
                const removeAt = (i: number) => {
                  opts.removeValue(i);
                  const ci = form.getFieldValue("correct_index");
                  if (ci !== "") {
                    const n = Number(ci);
                    if (n === i) form.setFieldValue("correct_index", "");
                    else if (n > i)
                      form.setFieldValue("correct_index", String(n - 1));
                  }
                };
                return (
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">
                      Pilihan Jawaban (pilih yang benar)
                    </legend>
                    <div className="space-y-1">
                      {opts.state.value.map((_, i) => (
                        <div key={opts.state.value[i] || `new-option-${i}`} className="flex items-start gap-2">
                          <form.Field name="correct_index">
                            {(cf) => (
                              <CorrectOptionRadio
                                index={i}
                                checked={cf.state.value === String(i)}
                                onSelect={cf.handleChange}
                              />
                            )}
                          </form.Field>
                          <div className="flex-1">
                            <form.Field name={`options[${i}]` as const}>
                              {(f) => (
                                <TextField
                                  label={`Pilihan ${letter(i)}`}
                                  field={f}
                                  maxLength={310}
                                />
                              )}
                            </form.Field>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm mt-8"
                            disabled={count <= MIN_OPTIONS}
                            onClick={() => removeAt(i)}
                            aria-label={`Hapus pilihan ${letter(i)}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm w-fit text-primary"
                      disabled={count >= MAX_OPTIONS}
                      onClick={() => opts.pushValue("")}
                    >
                      <Plus className="size-4" /> Tambah pilihan
                    </button>
                    {listMsg ? (
                      <p role="alert" className="text-xs text-error">
                        {listMsg}
                      </p>
                    ) : null}
                    <form.Field name="correct_index">
                      {(cf) => {
                        const m = cf.state.meta.isTouched
                          ? firstMessage(cf.state.meta.errors)
                          : "";
                        return m ? (
                          <p role="alert" className="text-xs text-error">
                            {m}
                          </p>
                        ) : null;
                      }}
                    </form.Field>
                  </fieldset>
                );
              }}
            </form.Field>
          ) : (
            <p className="rounded-box bg-base-200 p-3 text-sm text-base-content/70">
              Soal esai dijawab dengan teks bebas dan dinilai manual oleh guru
              atau admin. Nilai baru tampil ke siswa setelah dinilai.
            </p>
          )
        }
      </form.Subscribe>

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
