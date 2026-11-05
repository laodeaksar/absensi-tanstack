import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Check, KeyRound, UserCheck, X } from "lucide-react";
import { useMemo, useRef } from "react";

import { ErrorAlert, TextField, TextAreaField, Tip } from "~/components/ui";
import { api } from "~/lib/api";
import { letter, makeGradeSchema } from "~/lib/assignment-schema";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import { reviewQuery, qk } from "~/lib/queries";
import { toast } from "~/lib/toast";

export const Route = createFileRoute(
  "/_app/assignments/$assignmentId/review/$submissionId",
)({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context, params }) =>
    context.queryClient.query(reviewQuery(params.submissionId)),
  component: ReviewPage,
});

function ReviewPage() {
  const { assignmentId, submissionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(reviewQuery(submissionId));
  const { submission, student, assignment, answers } = data;

  const essays = useMemo(
    () => answers.filter((a) => a.question.type === "esai"),
    [answers],
  );
  const essayIndex = useMemo(
    () => new Map(essays.map((a, i) => [a.question.question_id, i])),
    [essays],
  );

  // Batas nilai tiap esai mengikuti poin soalnya
  const schema = useMemo(
    () =>
      makeGradeSchema(
        essays.map((a) => ({
          question_id: a.question.question_id,
          points: a.question.points,
        })),
      ),
    [essays],
  );

  // Setelah berhasil disimpan, pindah halaman tidak perlu ditahan
  const saved = useRef(false);

  const save = useMutation({
    mutationFn: (
      grades: {
        question_id: string;
        score: string;
        feedback: string;
      }[],
    ) => api.grade(submissionId, grades),
    onSuccess: (r) => {
      saved.current = true;
      toast.success(r.message);
      void qc.invalidateQueries({
        queryKey: qk.review(submissionId),
      });
      void qc.invalidateQueries({
        queryKey: qk.subs(assignmentId),
      });
      void qc.invalidateQueries({
        queryKey: qk.list,
      });
      void navigate({
        to: "/assignments/$assignmentId/submissions",
        params: { assignmentId },
      });
    },
  });

  const form = useForm({
    defaultValues: {
      grades: essays.map((a) => ({
        question_id: a.question.question_id,
        score: a.score === "" ? "" : String(a.score),
        feedback: a.feedback,
      })),
    },
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmitInvalid: () => toast.error("Lengkapi nilai semua soal esai."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync(
          value.grades.map((g) => ({
            question_id: g.question_id,
            score: g.score.trim().replace(",", "."),
            feedback: g.feedback.trim(),
          })),
        )
        .catch(() => {});
    },
  });

  // Peringatkan bila meninggalkan halaman dengan nilai atau komentar yang belum disimpan
  useBlocker({
    shouldBlockFn: () => {
      if (saved.current || !form.state.isDirty) return false;
      return !window.confirm(
        "Nilai atau komentar belum disimpan. Tinggalkan halaman ini?",
      );
    },
    enableBeforeUnload: () => !saved.current && form.state.isDirty,
  });

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/assignments/$assignmentId/submissions"
          params={{ assignmentId }}
          className="btn btn-ghost btn-xs mb-1 -ml-2"
        >
          <ArrowLeft className="size-4" /> Kembali
        </Link>
        <h2 className="text-2xl font-bold">{assignment.title}</h2>
        <p className="text-sm text-base-content/60">
          {student.full_name} (NIS {student.nis}) - Kelas{" "}
          {assignment.class_name} - dikumpulkan{" "}
          {submission.submitted_at
            ? formatDateTime(submission.submitted_at)
            : "-"}
        </p>
      </div>

      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {answers.map((a, n) => {
          const q = a.question;
          if (q.type === "pilihan_ganda") {
            const chosen = a.answer === "" ? -1 : Number(a.answer);
            return (
              <div
                key={q.question_id}
                className="card border border-base-300 bg-base-100"
              >
                <div className="card-body gap-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-line font-medium">
                      {n + 1}. {q.text}
                    </p>
                    <span
                      className={`badge badge-soft shrink-0 ${a.is_correct ? "badge-success" : "badge-error"}`}
                    >
                      {a.is_correct ? (
                        <Check className="mr-1 size-3" />
                      ) : (
                        <X className="mr-1 size-3" />
                      )}
                      {a.score === "" ? 0 : a.score}/{q.points}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {q.options.map((o, i) => {
                      const isKey = i === Number(q.correct_index);
                      const isChosen = i === chosen;
                      return (
                        <li
                          key={`${q.question_id}-${i}`}
                          className={`flex items-center gap-2 ${isKey ? "font-semibold text-success" : ""}`}
                        >
                          <span className="w-5 shrink-0">{letter(i)}.</span>
                          <span className="min-w-0 wrap-anywhere">{o}</span>
                          {isChosen ? (
                            <Tip
                              tip="Jawaban siswa"
                              side="top"
                            >
                              <span
                                role="img"
                                aria-label="Jawaban siswa"
                                tabIndex={0}
                                className={`inline-flex shrink-0 ${isKey ? "text-success" : "text-error"}`}
                              >
                                <UserCheck className="size-4" />
                              </span>
                            </Tip>
                          ) : null}
                          {isKey ? (
                            <Tip
                              tip="Kunci jawaban"
                              side="top"
                            >
                              <span
                                role="img"
                                aria-label="Kunci jawaban"
                                tabIndex={0}
                                className="inline-flex shrink-0 text-success"
                              >
                                <KeyRound className="size-4" />
                              </span>
                            </Tip>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {chosen === -1 ? (
                    <p className="text-xs text-base-content/60">
                      Siswa tidak menjawab.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          }

          const k = essayIndex.get(q.question_id) ?? 0;
          return (
            <div
              key={q.question_id}
              className="card border border-warning/40 bg-base-100"
            >
              <div className="card-body gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-line font-medium wrap-anywhere">
                    {n + 1}. {q.text}
                  </p>
                  <span className="badge badge-warning badge-soft shrink-0">
                    Esai - maks {q.points}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-base-content/60">
                    Jawaban siswa
                  </p>
                  <div className="whitespace-pre-wrap rounded-box bg-base-200 p-3 text-sm wrap-anywhere">
                    {a.answer.trim() ? (
                      a.answer
                    ) : (
                      <span className="text-base-content/50">
                        (tidak dijawab)
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <form.Field name={`grades[${k}].score` as const}>
                    {(f) => (
                      <TextField
                        label={`Nilai (0-${q.points})`}
                        field={f}
                        inputMode="decimal"
                      />
                    )}
                  </form.Field>
                  <div className="sm:col-span-3">
                    <form.Field name={`grades[${k}].feedback` as const}>
                      {(f) => (
                        <TextAreaField
                          label="Komentar untuk siswa (opsional)"
                          field={f}
                          rows={2}
                        />
                      )}
                    </form.Field>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <ErrorAlert message={save.error?.message} />

        <div className="card sticky bottom-0 border border-base-300 bg-base-100 shadow-lg">
          <div className="card-body flex-row flex-wrap items-center justify-between gap-3 p-4">
            <form.Subscribe selector={(s) => s.values.grades}>
              {(grades) => {
                const manual = grades.reduce((t, g) => {
                  const v = Number(g.score.trim().replace(",", "."));
                  return (
                    t + (g.score.trim() !== "" && Number.isFinite(v) ? v : 0)
                  );
                }, 0);
                const total = submission.auto_score + manual;
                return (
                  <p className="text-sm">
                    Pilihan ganda <b>{submission.auto_score}</b> + esai{" "}
                    <b>{Math.round(manual * 100) / 100}</b> ={" "}
                    <b>{Math.round(total * 100) / 100}</b> /{" "}
                    {submission.max_score}
                    <span className="ml-1 text-base-content/60">
                      (
                      {submission.max_score > 0
                        ? Math.round((total / submission.max_score) * 1000) / 10
                        : 0}
                      %)
                    </span>
                  </p>
                );
              }}
            </form.Subscribe>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(busy) => (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || essays.length === 0}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  {submission.status === "diserahkan"
                    ? "Simpan & Tampilkan Nilai ke Siswa"
                    : "Perbarui Nilai"}
                </button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </form>
    </div>
  );
}
