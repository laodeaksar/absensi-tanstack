import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query, QueryCtx } from "./_generated/server";
import { requireAuth } from "./access";
import {
  classNameMap,
  deadlineOf,
  finalizeSubmission,
  findAssignment,
  GRACE_MS,
  maxScoreOf,
  questionOut,
  questionsOf,
} from "./assignment.core";
import { fail } from "./errors";
import { nowIso, num, randomId, round1, round2, dueMs } from "./lib";
import { LIMITS } from "./limits";

export const listMyTasks = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await student(ctx, token);
    const mine = new Set(await myClassIds(ctx, user.student_id));
    const classes = await classNameMap(ctx);
    const subjectNames = new Map(
      (await ctx.db.query("subjects").collect()).map(
        (s) => [s.subject_id, s.name] as const,
      ),
    );
    // Per kelas lewat index by_class, bukan memindai seluruh tabel tugas
    const assignments = (
      await Promise.all(
        [...mine].map((classId) =>
          ctx.db
            .query("assignments")
            .withIndex("by_class", (q) => q.eq("class_id", classId))
            .collect(),
        ),
      )
    )
      .flat()
      .filter((a) => a.is_published);

    const data = [];
    for (const a of assignments) {
      const qs = await questionsOf(ctx, a.assignment_id);
      const sub = await ctx.db
        .query("submissions")
        .withIndex("by_assignment_student", (q) =>
          q
            .eq("assignment_id", a.assignment_id)
            .eq("student_id", user.student_id),
        )
        .unique();
      const max = maxScoreOf(qs);
      const finished = sub?.status === "dinilai";
      data.push({
        assignment_id: a.assignment_id,
        title: a.title,
        description: a.description,
        class_name: classes.get(a.class_id) ?? "-",
        subject_name: a.subject_id
          ? (subjectNames.get(a.subject_id) ?? "-")
          : "",
        due_at: a.due_at,
        duration_minutes: a.duration_minutes,
        question_count: qs.length,
        max_score: max,
        status: sub ? sub.status : "belum",
        // Nilai hanya diberikan setelah status "dinilai" (esai sudah direview)
        score: finished ? num(sub!.total_score) : "",
        nilai:
          finished && max > 0
            ? round1((num(sub!.total_score) / max) * 100)
            : "",
        created_at: a.created_at,
      });
    }
    data.sort((x, y) => y.created_at.localeCompare(x.created_at));
    return { data };
  },
});

const answerInput = v.object({
  question_id: v.string(),
  answer: v.string(),
});

export const startTask = mutation({
  args: {
    token: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    if (
      !a.is_published ||
      !(await myClassIds(ctx, user.student_id)).includes(a.class_id)
    )
      fail("Tugas tidak tersedia.");
    const qs = await questionsOf(ctx, a.assignment_id);
    if (qs.length === 0) fail("Tugas belum memiliki soal.");

    const now = Date.now();
    let sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) =>
        q
          .eq("assignment_id", a.assignment_id)
          .eq("student_id", user.student_id),
      )
      .unique();

    if (sub && sub.status !== "berlangsung")
      fail("Tugas ini sudah dikumpulkan.");

    if (!sub) {
      const due = dueMs(a.due_at);
      if (due && now > due) fail("Batas waktu pengumpulan sudah lewat.");
      const id = await ctx.db.insert("submissions", {
        submission_id: randomId("SUB"),
        assignment_id: a.assignment_id,
        student_id: user.student_id,
        status: "berlangsung",
        started_at: now,
        submitted_at: null,
        auto_score: null,
        manual_score: null,
        total_score: null,
        max_score: maxScoreOf(qs),
        graded_by: "",
        graded_at: null,
        updated_at: nowIso(),
      });
      sub = (await ctx.db.get(id))!;
      // Tutup otomatis bila siswa tidak pernah kembali setelah waktu habis
      const closeAt = deadlineOf(a, sub);
      if (closeAt)
        await ctx.scheduler.runAt(
          closeAt + GRACE_MS,
          internal.assignment.autoCloseSubmission,
          { submissionId: sub.submission_id },
        );
    }

    const deadline = deadlineOf(a, sub);
    if (deadline && now > deadline + GRACE_MS) {
      // Waktu habis tanpa kumpul. Catatan: perubahan di sini ikut dibatalkan bila kita melempar error,
      // jadi penutupan dilakukan lalu hasilnya dikembalikan sebagai pesan, bukan exception.
      await finalizeSubmission(ctx, sub, qs, new Map());
      return {
        closed: true as const,
        message: "Waktu mengerjakan sudah habis. Tugas ditutup otomatis.",
      };
    }

    const drafts = await ctx.db
      .query("answers")
      .withIndex("by_submission", (x) =>
        x.eq("submission_id", sub.submission_id),
      )
      .collect();

    return {
      closed: false as const,
      submission_id: sub.submission_id,
      assignment: {
        assignment_id: a.assignment_id,
        title: a.title,
        description: a.description,
        duration_minutes: a.duration_minutes,
        due_at: a.due_at,
      },
      questions: qs.map((q) => questionOut(q, true)),
      started_at: sub.started_at,
      deadline,
      server_now: now,
      // Draf jawaban tersimpan (saveDraft) agar pengerjaan bisa dilanjutkan
      saved_answers: Object.fromEntries(
        drafts.map((x) => [x.question_id, x.answer]),
      ),
    };
  },
});

export const submitTask = mutation({
  args: {
    token: v.string(),
    assignmentId: v.string(),
    answers: v.array(answerInput),
  },
  handler: async (ctx, { token, assignmentId, answers }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) =>
        q
          .eq("assignment_id", a.assignment_id)
          .eq("student_id", user.student_id),
      )
      .unique();
    if (!sub) fail("Anda belum memulai tugas ini.");
    if (sub!.status !== "berlangsung") fail("Tugas ini sudah dikumpulkan.");

    const qs = await questionsOf(ctx, a.assignment_id);
    const deadline = deadlineOf(a, sub!);
    if (deadline && Date.now() > deadline + GRACE_MS) {
      // Jawaban yang baru dikirim ditolak (lewat batas); yang dinilai adalah draf tersimpan terakhir
      const needsReview = await finalizeSubmission(ctx, sub!, qs, new Map());
      return {
        status: needsReview ? ("diserahkan" as const) : ("dinilai" as const),
        closed: true,
        message:
          "Waktu mengerjakan sudah habis. Jawaban yang tersimpan terakhir yang dinilai.",
      };
    }

    const map = new Map<string, unknown>();
    for (const x of answers as Record<string, unknown>[])
      if (x && x.question_id) map.set(String(x.question_id), x.answer);
    const needsReview = await finalizeSubmission(ctx, sub!, qs, map);
    return {
      status: needsReview ? ("diserahkan" as const) : ("dinilai" as const),
      closed: false,
      message: needsReview
        ? "Jawaban dikumpulkan. Nilai akan tampil setelah soal esai dinilai guru."
        : "Jawaban dikumpulkan. Nilai Anda sudah tersedia.",
    };
  },
});

/** Simpan draf jawaban selama mengerjakan (panggil berkala dari klien, mis. tiap 20-30 detik). */
export const saveDraft = mutation({
  args: {
    token: v.string(),
    assignmentId: v.string(),
    answers: v.array(answerInput),
  },
  handler: async (ctx, { token, assignmentId, answers }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) =>
        q
          .eq("assignment_id", a.assignment_id)
          .eq("student_id", user.student_id),
      )
      .unique();
    if (!sub || sub.status !== "berlangsung")
      return { ok: false as const, saved: 0 };
    const deadline = deadlineOf(a, sub);
    if (deadline && Date.now() > deadline + GRACE_MS)
      return { ok: false as const, saved: 0 };

    const types = new Map(
      (await questionsOf(ctx, a.assignment_id)).map((q) => [
        q.question_id,
        q.type,
      ]),
    );
    const existing = new Map(
      (
        await ctx.db
          .query("answers")
          .withIndex("by_submission", (x) =>
            x.eq("submission_id", sub.submission_id),
          )
          .collect()
      ).map((x) => [x.question_id, x]),
    );
    const latest = new Map(answers.map((x) => [x.question_id, x.answer])); // duplikat: yang terakhir menang

    let saved = 0;
    for (const [qid, raw] of latest) {
      const type = types.get(qid);
      if (!type) continue; // soal bukan milik tugas ini
      const answer = String(raw).slice(
        0,
        type === "esai" ? LIMITS.essayAnswer : 10,
      );
      const row = existing.get(qid);
      if (row) {
        if (row.answer !== answer) await ctx.db.patch(row._id, { answer });
      } else {
        await ctx.db.insert("answers", {
          answer_id: randomId("ANS"),
          submission_id: sub.submission_id,
          question_id: qid,
          answer,
          is_correct: null,
          score: null,
          feedback: "",
        });
      }
      saved++;
    }
    return { ok: true as const, saved };
  },
});

export const getMyResult = query({
  args: {
    token: v.optional(v.string()),
    assignmentId: v.string(),
  },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) =>
        q
          .eq("assignment_id", a.assignment_id)
          .eq("student_id", user.student_id),
      )
      .unique();
    if (!sub) fail("Anda belum mengerjakan tugas ini.");
    if (sub!.status === "berlangsung") fail("Tugas belum dikumpulkan.");

    const base = {
      title: a.title,
      status: sub!.status,
    } as Record<string, unknown>;
    if (sub!.status !== "dinilai") return base; // belum ada nilai untuk ditampilkan

    const qs = await questionsOf(ctx, a.assignment_id);
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submission", (q) =>
        q.eq("submission_id", sub!.submission_id),
      )
      .collect();
    const max = maxScoreOf(qs);
    const mcq = {
      correct: 0,
      total: 0,
      score: 0,
      max: 0,
    };
    const essay = { total: 0, score: 0, max: 0 };
    const feedbacks: {
      no: number;
      points: number;
      score: number;
      text: string;
    }[] = [];

    qs.forEach((q, i) => {
      const ans = answers.find((x) => x.question_id === q.question_id);
      if (q.type === "pilihan_ganda") {
        mcq.total++;
        mcq.max += q.points;
        if (ans?.is_correct) mcq.correct++;
        mcq.score += ans?.score ?? 0;
      } else {
        essay.total++;
        essay.max += q.points;
        essay.score += ans?.score ?? 0;
        feedbacks.push({
          no: i + 1,
          points: q.points,
          score: ans?.score ?? 0,
          text: ans?.feedback ?? "",
        });
      }
    });

    const total = num(sub!.total_score);
    return {
      ...base,
      score: total,
      max_score: max,
      nilai: max > 0 ? round1((total / max) * 100) : 0,
      mcq: { ...mcq, score: round2(mcq.score) },
      essay: {
        ...essay,
        score: round2(essay.score),
      },
      feedbacks,
    };
  },
});

async function student(ctx: QueryCtx, token: string | undefined) {
  const user = await requireAuth(ctx, token, {
    allowStudent: true,
  });
  if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");
  return user;
}

async function myClassIds(ctx: QueryCtx, studentId: string) {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_student", (q) => q.eq("student_id", studentId))
    .collect();
  return [...new Set(hist.filter((h) => h.is_active).map((h) => h.class_id))];
}
