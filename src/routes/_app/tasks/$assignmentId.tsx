import { useForm, useStore } from "@tanstack/react-form";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Clock, Hourglass, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AnswerInput, TaskSession } from "~/lib/types";

import {
  ErrorAlert,
  PageSpinner,
  TextAreaField,
  RadioField,
} from "~/components/ui";
import { LIMITS } from "~/convex/limits";
import { useConfirm } from "~/hooks/use-confirm";
import { api } from "~/lib/api";
import { letter, makeTakeSchema, nowLocalInput } from "~/lib/assignment-schema";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import { myResultQuery, myTasksQuery, qk, settingsQuery } from "~/lib/queries";
import { toast } from "~/lib/toast";
import { useDraftAutosave } from "~/lib/use-draft-autosave";

export const Route = createFileRoute("/_app/tasks/$assignmentId")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  loader: ({ context }) => context.queryClient.query(myTasksQuery),
  component: TaskPage,
});

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
};

function BackLink() {
  return (
    <Link
      to="/tasks"
      className="btn btn-ghost btn-xs mb-1 -ml-2"
    >
      <ArrowLeft className="size-4" /> Daftar tugas
    </Link>
  );
}

function TaskPage() {
  const { assignmentId } = Route.useParams();
  const qc = useQueryClient();
  const { data: tasks } = useSuspenseQuery(myTasksQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const task = tasks.find((t) => t.assignment_id === assignmentId);
  const [session, setSession] = useState<TaskSession | null>(null);

  const start = useMutation({
    mutationFn: () => api.start(assignmentId),
    onSuccess: (s) => setSession(s),
    onError: (e) => {
      toast.error(e.message);
      void qc.invalidateQueries({
        queryKey: qk.myTasks,
      }); // status mungkin berubah (sudah dikumpulkan / waktu habis)
    },
  });

  // Render ulang tiap 30 detik agar status "lewat tenggat" ikut berubah selama halaman terbuka
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Tenggat dibandingkan dengan jam zona waktu sekolah (sama dengan server), bukan jam perangkat
  const isLate =
    task?.status === "belum" &&
    task.due_at !== "" &&
    task.due_at <= nowLocalInput(Number(settings.tz_offset_minutes));
  const isContinuing = task?.status === "berlangsung";
  const isLoading = start.isPending;

  const label = useMemo(() => {
    if (isLate) return "Lewat tenggat";
    if (isContinuing) return "Lanjutkan Mengerjakan";
    return "Mulai Mengerjakan";
  }, [isLate, isContinuing]);

  if (!task) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div
          role="alert"
          className="alert alert-warning alert-soft"
        >
          Tugas tidak ditemukan atau belum tersedia untuk Anda.
        </div>
      </div>
    );
  }

  if (session)
    return (
      <TaskForm
        session={session}
        key={session.submission_id}
        onFinished={() => setSession(null)}
      />
    );

  if (task.status === "dinilai")
    return <ResultCard assignmentId={assignmentId} />;

  if (task.status === "diserahkan") {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="card border border-base-300 bg-base-100">
          <div className="card-body items-center gap-3 py-10 text-center">
            <Hourglass className="size-10 text-warning" />
            <h2 className="text-xl font-bold">{task.title}</h2>
            <p className="max-w-md text-base-content/70">
              Jawaban Anda sudah dikumpulkan. Nilai akan tampil setelah soal
              esai selesai dinilai oleh guru.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-3">
          <h2 className="card-title text-2xl">{task.title}</h2>
          {task.description ? (
            <p className="whitespace-pre-line text-base-content/80">
              {task.description}
            </p>
          ) : null}
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <li>
              <span className="text-base-content/60">Jumlah soal</span>
              <br />
              <b>{task.question_count}</b>
            </li>
            <li>
              <span className="text-base-content/60">Total poin</span>
              <br />
              <b>{task.max_score}</b>
            </li>
            <li>
              <span className="text-base-content/60">Durasi</span>
              <br />
              <b>
                {task.duration_minutes > 0
                  ? `${task.duration_minutes} menit`
                  : "Bebas"}
              </b>
            </li>
            <li>
              <span className="text-base-content/60">Tenggat</span>
              <br />
              <b>{task.due_at ? formatDateTime(task.due_at) : "-"}</b>
            </li>
          </ul>
          <div
            role="alert"
            className="alert alert-info alert-soft text-sm"
          >
            Tugas hanya dapat dikerjakan satu kali. Setelah dikumpulkan, jawaban
            tidak dapat diubah.
            {task.duration_minutes > 0
              ? " Waktu berjalan sejak Anda menekan tombol mulai."
              : ""}
          </div>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isLoading || isLate}
              onClick={() => start.mutate()}
              title={isLate ? "Tenggat waktu sudah lewat" : undefined}
            >
              {isLoading && (
                <span className="loading loading-spinner loading-sm" />
              )}
              {label}
            </button>
            {isLate && (
              <span className="text-xs text-error mt-1">
                Tenggat telah berakhir
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- hasil nilai (hanya setelah status "dinilai") ---------- */

function ResultCard({ assignmentId }: Readonly<{ assignmentId: string }>) {
  const q = useQuery(myResultQuery(assignmentId));
  if (q.isPending) return <PageSpinner />;
  if (q.error) return <ErrorAlert message={q.error.message} />;
  const r = q.data;

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <h2 className="card-title text-2xl">{r.title}</h2>
          <div className="stats stats-vertical border border-base-300 sm:stats-horizontal">
            <div className="stat">
              <div className="stat-title">Nilai</div>
              <div className="stat-value text-primary">{r.nilai}</div>
              <div className="stat-desc">skala 0 - 100</div>
            </div>
            <div className="stat">
              <div className="stat-title">Skor</div>
              <div className="stat-value text-2xl">
                {r.score}{" "}
                <span className="text-base font-normal text-base-content/60">
                  / {r.max_score}
                </span>
              </div>
            </div>
          </div>

          <ul className="space-y-1 text-sm">
            {r.mcq && r.mcq.total > 0 ? (
              <li>
                Pilihan ganda: <b>{r.mcq.correct}</b> dari {r.mcq.total} benar
                (skor {r.mcq.score}/{r.mcq.max})
              </li>
            ) : null}
            {r.essay && r.essay.total > 0 ? (
              <li>
                Esai: skor <b>{r.essay.score}</b>/{r.essay.max}
              </li>
            ) : null}
          </ul>

          {r.feedbacks && r.feedbacks.some((f) => f.text) ? (
            <div>
              <h3 className="mb-2 font-semibold">Komentar guru</h3>
              <ul className="space-y-2">
                {r.feedbacks
                  .filter((f) => f.text)
                  .map((f) => (
                    <li
                      key={f.no}
                      className="rounded-box bg-base-200 p-3 text-sm"
                    >
                      <p className="mb-1 text-xs text-base-content/60">
                        Soal {f.no} - {f.score}/{f.points}
                      </p>
                      <p className="whitespace-pre-line">{f.text}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- pengerjaan ---------- */

function TaskForm({
  session,
  onFinished,
}: Readonly<{
  session: TaskSession;
  onFinished: () => void;
}>) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const id = session.assignment.assignment_id;
  const draftKey = `task-draft:${session.submission_id}`;

  // Draf jawaban: sessionStorage (selalu terbaru di tab ini) dan draf di server (saved_answers,
  // untuk melanjutkan di tab/perangkat lain atau setelah penyimpanan lokal hilang)
  const initial = useMemo(() => {
    let draft: Record<string, unknown> = {};
    try {
      draft = JSON.parse(sessionStorage.getItem(draftKey) || "{}");
    } catch {
      /* abaikan draf rusak */
    }
    return session.questions.map((q) => {
      const local = draft[q.question_id];
      return {
        question_id: q.question_id,
        answer:
          typeof local === "string" && local !== ""
            ? local
            : (session.saved_answers?.[q.question_id] ?? ""),
      };
    });
  }, [session, draftKey]);

  const schema = useMemo(
    () => makeTakeSchema(session.questions),
    [session.questions],
  );

  const submit = useMutation({
    mutationFn: (answers: AnswerInput[]) => api.submit(id, answers),
    onSuccess: async (r) => {
      sessionStorage.removeItem(draftKey);
      toast.success(r.message);
      await Promise.all([
        qc.invalidateQueries({
          queryKey: qk.myTasks,
        }),
        qc.invalidateQueries({
          queryKey: qk.result(id),
        }),
      ]);
      onFinished();
    },
    onError: async (e) => {
      toast.error(e.message);
      if (/habis|sudah dikumpulkan/i.test(e.message)) {
        await qc.invalidateQueries({
          queryKey: qk.myTasks,
        });
        onFinished();
      }
    },
  });

  const auto = useRef(false);
  const sending = useRef(false);
  // Satu pengiriman pada satu waktu. Bila gagal, dibuka lagi agar tombol Kumpulkan bisa dicoba ulang.
  const send = (answers: AnswerInput[]) => {
    if (sending.current) return Promise.resolve();
    sending.current = true;
    return submit.mutateAsync(answers).then(
      () => undefined,
      () => {
        sending.current = false;
      },
    );
  };

  const form = useForm({
    defaultValues: { answers: initial },
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali jawaban yang ditandai merah."),
    onSubmit: async ({ value }) => {
      const blank = value.answers.filter((a) => !a.answer.trim()).length;
      const ok = await confirm(
        blank > 0
          ? `Masih ada ${blank} soal yang belum dijawab. Kumpulkan sekarang?\nJawaban tidak dapat diubah setelah dikumpulkan.`
          : "Kumpulkan jawaban sekarang?\nJawaban tidak dapat diubah setelah dikumpulkan.",
      );
      if (!ok) return;
      await send(value.answers);
    },
  });

  const answers = useStore(form.store, (s) => s.values.answers);
  useEffect(() => {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify(
        Object.fromEntries(answers.map((a) => [a.question_id, a.answer])),
      ),
    );
  }, [answers, draftKey]);

  // hitung selisih server - client SEKALI pas component mount
  // ini boleh impure karena di dalam lazy initializer
  const [offset] = useState(() => session.server_now - Date.now());

  const [left, setLeft] = useState(() => {
    return session.deadline
      ? session.deadline - (Date.now() + offset)
      : Infinity;
  });

  useEffect(() => {
    if (!session.deadline) return;
    const tick = () => setLeft(session.deadline - (Date.now() + offset));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session.deadline, offset]);

  // Waktu habis: kumpulkan otomatis apa adanya (tanpa dialog)
  useEffect(() => {
    if (left <= 0 && !auto.current) {
      auto.current = true;
      toast.info("Waktu habis. Jawaban dikumpulkan otomatis.");
      void send(form.state.values.answers);
    }
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simpan draf ke server tiap ~25 detik; berhenti saat waktu habis atau sedang/selesai mengumpulkan
  useDraftAutosave(id, () => form.state.values.answers, {
    enabled: left > 0 && !submit.isPending && !submit.isSuccess,
  });

  const answered = answers.filter((a) => a.answer.trim()).length;
  const hasTimer = Number.isFinite(left);

  return (
    <div className="space-y-4">
      <div className="card sticky top-0 z-10 border border-base-300 bg-base-100 shadow">
        <div className="card-body flex-row flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <h2 className="font-bold">{session.assignment.title}</h2>
            <p className="text-xs text-base-content/60">
              Terjawab {answered} dari {session.questions.length} soal
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasTimer ? (
              <span
                className={`badge badge-lg gap-1 ${left < 60_000 ? "badge-error" : "badge-neutral"}`}
                role="timer"
              >
                <Clock className="size-4" /> {mmss(left)}
              </span>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={submit.isPending}
              onClick={() => form.handleSubmit()}
            >
              {submit.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Send className="size-4" />
              )}
              Kumpulkan
            </button>
          </div>
        </div>
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
        {session.questions.map((q, i) => (
          <div
            key={q.question_id}
            className="card border border-base-300 bg-base-100"
          >
            <div className="card-body gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 whitespace-pre-line font-medium wrap-anywhere">
                  {i + 1}. {q.text}
                </p>
                <span className="badge badge-ghost shrink-0">
                  {q.points} poin
                </span>
              </div>

              {q.type === "pilihan_ganda" ? (
                <form.Field name={`answers[${i}].answer` as const}>
                  {(f) => (
                    <RadioField
                      label={`Soal ${i + 1}`}
                      hideLabel
                      variant="card"
                      field={f}
                      options={q.options.map((o, oi) => ({
                        value: String(oi),
                        label: (
                          <>
                            <b>{letter(oi)}.</b> {o}
                          </>
                        ),
                      }))}
                    />
                  )}
                </form.Field>
              ) : (
                <form.Field name={`answers[${i}].answer` as const}>
                  {(f) => (
                    <TextAreaField
                      label="Jawaban Anda"
                      field={f}
                      rows={6}
                      hint={`${f.state.value.length}/${LIMITS.essayAnswer} karakter`}
                    />
                  )}
                </form.Field>
              )}
            </div>
          </div>
        ))}

        <ErrorAlert message={submit.error?.message} />
      </form>
      {dialog}
    </div>
  );
}
