import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  canAccessClass,
  classById,
  dueMs,
  fail,
  nowIso,
  num,
  randomId,
  requireAuth,
  round1,
  round2,
  studentById,
} from "./lib";
import { LIMITS } from "./limits";

const GRACE_MS = 60_000; // toleransi keterlambatan jaringan saat kumpul
// const ESSAY_MAX = 5000;

/* ---------- helper ---------- */

const assignmentInput = v.object({
  assignment_id: v.optional(v.string()), // "" untuk tugas baru
  title: v.string(),
  description: v.string(),
  class_id: v.string(),
  due_at: v.string(),
  duration_minutes: v.number(),
  is_published: v.boolean(),
});

const questionInput = v.object({
  question_id: v.optional(v.string()), // "" untuk soal baru
  assignment_id: v.string(),
  type: v.union(v.literal("pilihan_ganda"), v.literal("esai")),
  text: v.string(),
  options: v.array(v.string()),
  correct_index: v.union(v.number(), v.literal("")), // klien mengirim "" untuk esai
  points: v.number(),
});

const gradeInput = v.object({
  question_id: v.string(),
  score: v.union(v.string(), v.number()),
  feedback: v.optional(v.string()),
});

const answerInput = v.object({
  question_id: v.string(),
  answer: v.string(),
});

async function staff(ctx: QueryCtx, token: string) {
  return requireAuth(ctx, token); // siswa -> FORBIDDEN
}

async function student(ctx: QueryCtx, token: string) {
  const user = await requireAuth(ctx, token, {
    allowStudent: true,
  });
  if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");
  return user;
}

async function findAssignment(ctx: QueryCtx, id: string) {
  const a = await ctx.db
    .query("assignments")
    .withIndex("by_assignment_id", (q) => q.eq("assignment_id", id))
    .unique();
  if (!a) fail("Tugas tidak ditemukan.");
  return a!;
}

async function manageAssignment(ctx: QueryCtx, user: Doc<"users">, id: string) {
  const a = await findAssignment(ctx, id);
  if (!canAccessClass(user, a.class_id))
    fail("Anda tidak memiliki akses ke tugas ini.");
  return a;
}

async function findSubmission(ctx: QueryCtx, id: string) {
  const s = await ctx.db
    .query("submissions")
    .withIndex("by_submission_id", (q) => q.eq("submission_id", id))
    .unique();
  if (!s) fail("Data pengumpulan tidak ditemukan.");
  return s!;
}

const questionsOf = async (ctx: QueryCtx, assignmentId: string) =>
  (
    await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
      .collect()
  ).sort((a, b) => a.order_no - b.order_no);

const submissionsOf = (ctx: QueryCtx, assignmentId: string) =>
  ctx.db
    .query("submissions")
    .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
    .collect();

const maxScoreOf = (qs: Doc<"questions">[]) =>
  qs.reduce((t, q) => t + q.points, 0);

/** Batas akhir pengerjaan: yang lebih awal antara tenggat dan (mulai + durasi); 0 = tanpa batas. */
function deadlineOf(a: Doc<"assignments">, sub: { started_at: number }) {
  const due = dueMs(a.due_at);
  const byDuration =
    a.duration_minutes > 0 ? sub.started_at + a.duration_minutes * 60_000 : 0;
  if (due && byDuration) return Math.min(due, byDuration);
  return due || byDuration;
}

function questionOut(q: Doc<"questions">, forStudent: boolean) {
  const out = {
    question_id: q.question_id,
    type: q.type,
    text: q.text,
    options: q.options,
    points: q.points,
    order_no: q.order_no,
  } as Record<string, unknown>;
  // Kunci jawaban tidak pernah dikirim ke siswa
  if (!forStudent)
    out.correct_index =
      q.type === "pilihan_ganda" && q.correct_index !== null
        ? q.correct_index
        : "";
  return out;
}

async function classNameMap(ctx: QueryCtx) {
  const m = new Map<string, string>();
  for (const c of await ctx.db.query("classes").collect())
    m.set(c.class_id, c.class_name);
  return m;
}

async function activeMemberIds(ctx: QueryCtx, classId: string) {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_class", (q) => q.eq("class_id", classId))
    .collect();
  return [...new Set(hist.filter((h) => h.is_active).map((h) => h.student_id))];
}

async function myClassIds(ctx: QueryCtx, studentId: string) {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_student", (q) => q.eq("student_id", studentId))
    .collect();
  return [...new Set(hist.filter((h) => h.is_active).map((h) => h.class_id))];
}

/* ==========================================
 * A. GURU / ADMIN - TUGAS
 * ========================================== */

export const listAssignments = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await staff(ctx, token);
    const classes = await classNameMap(ctx);
    // Admin melihat semua; guru hanya kelas yang diampu (lewat index by_class, tanpa memindai tabel)
    const pool =
      user.role === "admin"
        ? await ctx.db.query("assignments").collect()
        : (
            await Promise.all(
              user.assigned_classes.map((classId) =>
                ctx.db
                  .query("assignments")
                  .withIndex("by_class", (q) => q.eq("class_id", classId))
                  .collect(),
              ),
            )
          ).flat();
    const all = pool.filter((a) => canAccessClass(user, a.class_id));

    const data = [];
    for (const a of all) {
      const qs = await ctx.db
        .query("questions")
        .withIndex("by_assignment", (q) =>
          q.eq("assignment_id", a.assignment_id),
        )
        .collect();
      const subs = await submissionsOf(ctx, a.assignment_id);
      data.push({
        assignment_id: a.assignment_id,
        title: a.title,
        description: a.description,
        class_id: a.class_id,
        class_name: classes.get(a.class_id) ?? "-",
        due_at: a.due_at,
        duration_minutes: a.duration_minutes,
        is_published: a.is_published,
        question_count: qs.length,
        started_count: subs.length,
        submitted_count: subs.filter((s) => s.status !== "berlangsung").length,
        pending_count: subs.filter((s) => s.status === "diserahkan").length,
        created_at: a.created_at,
      });
    }
    data.sort((x, y) => y.created_at.localeCompare(x.created_at));
    return { data };
  },
});

export const saveAssignment = mutation({
  args: {
    token: v.string(),
    data: assignmentInput,
  },
  handler: async (ctx, { token, data }) => {
    const user = await staff(ctx, token);
    if (!data) fail("Data tugas tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const title = String(d.title ?? "").trim();
    const description = String(d.description ?? "").trim();
    if (!title) fail("Judul wajib diisi.");
    if (title.length > LIMITS.title)
      fail(`Judul maksimal ${LIMITS.title} karakter.`);
    if (description.length > LIMITS.description)
      fail(`Deskripsi maksimal ${LIMITS.description} karakter.`);

    const classId = String(d.class_id ?? "");
    const cls = await classById(ctx, classId);
    if (!cls || !cls.is_active) fail("Kelas tidak valid.");
    if (!canAccessClass(user, classId))
      fail("Anda tidak memiliki akses ke kelas ini.");

    const dueAt = String(d.due_at ?? "").trim();
    if (dueAt && !dueMs(dueAt)) fail("Format tenggat tidak valid.");

    const duration = Math.floor(Number(d.duration_minutes ?? 0));
    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > LIMITS.durationMinutes
    )
      fail(`Durasi harus 0 sampai ${LIMITS.durationMinutes} menit.`);

    const publish = d.is_published === true || d.is_published === "true";
    const existing = d.assignment_id
      ? await manageAssignment(ctx, user, String(d.assignment_id))
      : null;
    const now = nowIso();

    if (publish) {
      const count = existing
        ? (await questionsOf(ctx, existing.assignment_id)).length
        : 0;
      if (count === 0)
        fail("Tambahkan minimal satu soal sebelum mempublikasikan tugas.");
    }

    if (existing) {
      if (
        existing.class_id !== classId &&
        (await submissionsOf(ctx, existing.assignment_id)).length > 0
      ) {
        fail("Kelas tidak dapat diubah karena tugas sudah dikerjakan siswa.");
      }
      await ctx.db.patch(existing._id, {
        title,
        description,
        class_id: classId,
        due_at: dueAt,
        duration_minutes: duration,
        is_published: publish,
        updated_at: now,
      });
      return {
        message: "Tugas diperbarui.",
        assignment_id: existing.assignment_id,
      };
    }

    const id = randomId("ASG");
    await ctx.db.insert("assignments", {
      assignment_id: id,
      title,
      description,
      class_id: classId,
      due_at: dueAt,
      duration_minutes: duration,
      is_published: false,
      created_by: user.user_id,
      created_at: now,
      updated_at: now,
    });
    return {
      message: "Tugas dibuat. Tambahkan soal lalu publikasikan.",
      assignment_id: id,
    };
  },
});

export const deleteAssignment = mutation({
  args: {
    token: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);

    // Tugas dan soal dihapus sekarang; jawaban siswa dibersihkan bertahap di latar belakang
    // agar penghapusan tugas besar tidak melewati batas tulis satu mutation
    for (const q of await questionsOf(ctx, assignmentId))
      await ctx.db.delete(q._id);
    await ctx.db.delete(a._id);
    await ctx.scheduler.runAfter(0, internal.assignment.purgeSubmissions, {
      assignmentId,
    });
    return {
      message: "Tugas dan soal dihapus. Jawaban siswa dibersihkan di latar belakang.",
    };
  },
});

const PURGE_BATCH = 25;

/** Hapus pengumpulan (beserta jawabannya) milik tugas yang sudah dihapus, per kelompok. */
export const purgeSubmissions = internalMutation({
  args: { assignmentId: v.string() },
  // Tipe kembalian eksplisit: fungsi ini menjadwalkan dirinya sendiri lewat `internal`
  handler: async (ctx, { assignmentId }): Promise<void> => {
    const subs = await ctx.db
      .query("submissions")
      .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
      .take(PURGE_BATCH);
    for (const s of subs) {
      for (const ans of await ctx.db
        .query("answers")
        .withIndex("by_submission", (q) => q.eq("submission_id", s.submission_id))
        .collect())
        await ctx.db.delete(ans._id);
      await ctx.db.delete(s._id);
    }
    if (subs.length === PURGE_BATCH)
      await ctx.scheduler.runAfter(0, internal.assignment.purgeSubmissions, {
        assignmentId,
      });
  },
});

export const getAssignmentDetail = query({
  args: {
    token: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);
    const qs = await questionsOf(ctx, assignmentId);
    const subs = await submissionsOf(ctx, assignmentId);
    const classes = await classNameMap(ctx);
    return {
      assignment: {
        assignment_id: a.assignment_id,
        title: a.title,
        description: a.description,
        class_id: a.class_id,
        class_name: classes.get(a.class_id) ?? "-",
        due_at: a.due_at,
        duration_minutes: a.duration_minutes,
        is_published: a.is_published,
        question_count: qs.length,
        started_count: subs.length,
        submitted_count: subs.filter((s) => s.status !== "berlangsung").length,
        pending_count: subs.filter((s) => s.status === "diserahkan").length,
      },
      questions: qs.map((q) => questionOut(q, false)),
      locked: subs.length > 0,
      max_score: maxScoreOf(qs),
    };
  },
});

export const setAssignmentPublished = mutation({
  args: {
    token: v.string(),
    assignmentId: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, { token, assignmentId, published }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);

    if (published && (await questionsOf(ctx, a.assignment_id)).length === 0) {
      fail("Tambahkan minimal satu soal sebelum mempublikasikan tugas.");
    }
    if (a.is_published !== published) {
      await ctx.db.patch(a._id, {
        is_published: published,
        updated_at: nowIso(),
      });
    }
    return {
      message: published
        ? "Tugas diterbitkan."
        : "Tugas dikembalikan ke Draft.",
      is_published: published,
    };
  },
});

/* ==========================================
 * B. GURU / ADMIN - SOAL
 * ========================================== */

const LOCKED_MSG =
  "Tugas sudah dikerjakan siswa, soal tidak dapat ditambah, diubah, atau dihapus.";

export const saveQuestion = mutation({
  args: {
    token: v.string(),
    data: questionInput,
  },
  handler: async (ctx, { token, data }) => {
    const user = await staff(ctx, token);
    if (!data) fail("Data soal tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const a = await manageAssignment(ctx, user, String(d.assignment_id ?? ""));
    if ((await submissionsOf(ctx, a.assignment_id)).length > 0)
      fail(LOCKED_MSG);

    const type = String(d.type ?? "");
    if (type !== "pilihan_ganda" && type !== "esai")
      fail("Tipe soal tidak valid.");
    const text = String(d.text ?? "").trim();
    if (!text) fail("Pertanyaan wajib diisi.");
    if (text.length > LIMITS.questionText)
      fail(`Pertanyaan maksimal ${LIMITS.questionText} karakter.`);
    const points = Number(d.points);
    if (
      !Number.isInteger(points) ||
      points < LIMITS.pointsMin ||
      points > LIMITS.pointsMax
    )
      fail(
        `Poin harus bilangan bulat ${LIMITS.pointsMin} sampai ${LIMITS.pointsMax}.`,
      );

    let options: string[] = [];
    let correct: number | null = null;
    if (type === "pilihan_ganda") {
      options = (Array.isArray(d.options) ? d.options : []).map((o) =>
        String(o).trim(),
      );
      if (options.length < LIMITS.optionsMin || options.length > LIMITS.optionsMax)
        fail(
          `Pilihan jawaban harus ${LIMITS.optionsMin} sampai ${LIMITS.optionsMax}.`,
        );
      const seen = new Set<string>();
      for (const o of options) {
        if (!o) fail("Semua pilihan jawaban wajib diisi.");
        if (o.length > LIMITS.optionText)
          fail(`Pilihan jawaban maksimal ${LIMITS.optionText} karakter.`);
        if (seen.has(o.toLowerCase())) fail("Ada pilihan jawaban yang sama.");
        seen.add(o.toLowerCase());
      }
      const c = Number(d.correct_index);
      if (!Number.isInteger(c) || c < 0 || c >= options.length)
        fail("Pilih satu jawaban yang benar.");
      correct = c;
    }

    const now = nowIso();
    const qType = type as "pilihan_ganda" | "esai";

    if (d.question_id) {
      const q = await ctx.db
        .query("questions")
        .withIndex("by_question_id", (x) =>
          x.eq("question_id", String(d.question_id)),
        )
        .unique();
      if (!q || q.assignment_id !== a.assignment_id)
        fail("Soal tidak ditemukan.");
      await ctx.db.patch(q!._id, {
        type: qType,
        text,
        options,
        correct_index: correct,
        points,
        updated_at: now,
      });
      return { message: "Soal diperbarui." };
    }

    const maxOrder = (await questionsOf(ctx, a.assignment_id)).reduce(
      (m, q) => Math.max(m, q.order_no),
      0,
    );
    await ctx.db.insert("questions", {
      question_id: randomId("QST"),
      assignment_id: a.assignment_id,
      type: qType,
      text,
      options,
      correct_index: correct,
      points,
      order_no: maxOrder + 1,
      created_at: now,
      updated_at: now,
    });
    return { message: "Soal ditambahkan." };
  },
});

export const deleteQuestion = mutation({
  args: {
    token: v.string(),
    questionId: v.string(),
  },
  handler: async (ctx, { token, questionId }) => {
    const user = await staff(ctx, token);
    const q = await ctx.db
      .query("questions")
      .withIndex("by_question_id", (x) => x.eq("question_id", questionId))
      .unique();
    if (!q) fail("Soal tidak ditemukan.");
    const a = await manageAssignment(ctx, user, q!.assignment_id);
    if ((await submissionsOf(ctx, a.assignment_id)).length > 0)
      fail(LOCKED_MSG);

    await ctx.db.delete(q!._id);
    // Tugas tanpa soal tidak boleh tetap terbit
    if (
      a.is_published &&
      (await questionsOf(ctx, a.assignment_id)).length === 0
    ) {
      await ctx.db.patch(a._id, {
        is_published: false,
        updated_at: nowIso(),
      });
    }
    return { message: "Soal dihapus." };
  },
});

/* ==========================================
 * C. GURU / ADMIN - PENGUMPULAN & PENILAIAN
 * ========================================== */

export const listSubmissions = query({
  args: {
    token: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);
    const max = maxScoreOf(await questionsOf(ctx, assignmentId));
    const subBy = new Map(
      (await submissionsOf(ctx, assignmentId)).map((s) => [s.student_id, s]),
    );
    const ids = new Set([
      ...(await activeMemberIds(ctx, a.class_id)),
      ...subBy.keys(),
    ]); // siswa pindah kelas tetap terlihat

    const rows = [];
    for (const id of ids) {
      const st = await studentById(ctx, id);
      const sub = subBy.get(id);
      const finished = sub?.status === "dinilai";
      const partial = sub?.status === "diserahkan";
      rows.push({
        student_id: id,
        nis: st?.nis || "-",
        full_name: st?.full_name || "Siswa Tidak Ditemukan",
        status: sub ? sub.status : "belum",
        submission_id: sub ? sub.submission_id : "",
        score: finished
          ? num(sub!.total_score)
          : partial
            ? num(sub!.auto_score)
            : "",
        max_score: max,
        nilai:
          finished && max > 0
            ? round1((num(sub!.total_score) / max) * 100)
            : "",
        submitted_at: sub && sub.submitted_at !== null ? sub.submitted_at : "",
      });
    }
    rows.sort((x, y) => String(x.full_name).localeCompare(String(y.full_name)));

    const classes = await classNameMap(ctx);
    return {
      assignment: {
        assignment_id: a.assignment_id,
        title: a.title,
        class_name: classes.get(a.class_id) ?? "-",
        max_score: max,
      },
      data: rows,
    };
  },
});

export const getSubmissionForReview = query({
  args: {
    token: v.string(),
    submissionId: v.string(),
  },
  handler: async (ctx, { token, submissionId }) => {
    const user = await staff(ctx, token);
    const sub = await findSubmission(ctx, submissionId);
    const a = await manageAssignment(ctx, user, sub.assignment_id);
    if (sub.status !== "diserahkan" && sub.status !== "dinilai")
      fail("Siswa belum mengumpulkan tugas ini.");

    const st = await studentById(ctx, sub.student_id);
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submission", (q) =>
        q.eq("submission_id", sub.submission_id),
      )
      .collect();
    const qs = await questionsOf(ctx, a.assignment_id);
    const classes = await classNameMap(ctx);

    return {
      submission: {
        submission_id: sub.submission_id,
        status: sub.status,
        auto_score: num(sub.auto_score),
        total_score: sub.total_score === null ? "" : sub.total_score,
        max_score: maxScoreOf(qs),
        submitted_at: num(sub.submitted_at),
      },
      student: {
        full_name: st?.full_name || "-",
        nis: st?.nis || "-",
      },
      assignment: {
        assignment_id: a.assignment_id,
        title: a.title,
        class_name: classes.get(a.class_id) ?? "-",
      },
      answers: qs.map((q) => {
        const ans = answers.find((x) => x.question_id === q.question_id);
        return {
          question: questionOut(q, false),
          answer: ans ? ans.answer : "",
          is_correct: ans ? ans.is_correct : null,
          score: ans && ans.score !== null ? ans.score : "",
          feedback: ans ? ans.feedback : "",
        };
      }),
    };
  },
});

/** grades: [{ question_id, score, feedback }] untuk SEMUA soal esai. Setelah ini status menjadi "dinilai". */
export const gradeSubmission = mutation({
  args: {
    token: v.string(),
    submissionId: v.string(),
    grades: v.array(gradeInput),
  },
  handler: async (ctx, { token, submissionId, grades }) => {
    const user = await staff(ctx, token);
    const sub = await findSubmission(ctx, submissionId);
    const a = await manageAssignment(ctx, user, sub.assignment_id);
    if (sub.status !== "diserahkan" && sub.status !== "dinilai")
      fail("Siswa belum mengumpulkan tugas ini.");

    const qs = await questionsOf(ctx, a.assignment_id);
    const gradeMap = new Map<string, Record<string, unknown>>();
    for (const g of grades as Record<string, unknown>[])
      if (g && g.question_id) gradeMap.set(String(g.question_id), g);

    // Validasi semua dulu, baru tulis
    const parsed = new Map<string, { score: number; feedback: string }>();
    for (const q of qs.filter((x) => x.type === "esai")) {
      const no = qs.indexOf(q) + 1;
      const g = gradeMap.get(q.question_id);
      const raw =
        g && g.score !== undefined && g.score !== null
          ? String(g.score).trim().replace(",", ".")
          : "";
      if (raw === "") fail(`Nilai soal esai nomor ${no} belum diisi.`);
      const sc = Number(raw);
      if (!Number.isFinite(sc) || sc < 0 || sc > q.points)
        fail(`Nilai soal nomor ${no} harus 0 sampai ${q.points}.`);
      const fb = String(g!.feedback ?? "").trim();
      if (fb.length > LIMITS.feedback)
        fail(`Komentar maksimal ${LIMITS.feedback} karakter.`);
      parsed.set(q.question_id, {
        score: round2(sc),
        feedback: fb,
      });
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submission", (x) =>
        x.eq("submission_id", sub.submission_id),
      )
      .collect();
    let auto = 0;
    let manual = 0;
    for (const q of qs) {
      const ans = answers.find((x) => x.question_id === q.question_id);
      if (q.type === "pilihan_ganda") {
        auto += ans?.score ?? 0;
        continue;
      }
      const p = parsed.get(q.question_id)!;
      manual += p.score;
      if (ans)
        await ctx.db.patch(ans._id, {
          score: p.score,
          feedback: p.feedback,
        });
      else {
        await ctx.db.insert("answers", {
          answer_id: randomId("ANS"),
          submission_id: sub.submission_id,
          question_id: q.question_id,
          answer: "",
          is_correct: null,
          score: p.score,
          feedback: p.feedback,
        });
      }
    }

    await ctx.db.patch(sub._id, {
      status: "dinilai",
      auto_score: round2(auto),
      manual_score: round2(manual),
      total_score: round2(auto + manual),
      max_score: maxScoreOf(qs),
      graded_by: user.user_id,
      graded_at: Date.now(),
      updated_at: nowIso(),
    });
    return {
      message: "Penilaian disimpan. Nilai kini terlihat oleh siswa.",
    };
  },
});

/* ==========================================
 * D. SISWA
 * ========================================== */

export const listMyTasks = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await student(ctx, token);
    const mine = new Set(await myClassIds(ctx, user.student_id));
    const classes = await classNameMap(ctx);
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

/**
 * Simpan jawaban + hitung nilai. Dipakai submitTask dan penutupan otomatis saat waktu habis.
 * Jawaban yang tidak ada di answerMap diambil dari draf (saveDraft), jadi penutupan otomatis
 * tetap menilai apa yang sudah sempat tersimpan.
 */
async function finalizeSubmission(
  ctx: MutationCtx,
  sub: Doc<"submissions">,
  qs: Doc<"questions">[],
  answerMap: Map<string, unknown>,
) {
  const drafts = await ctx.db
    .query("answers")
    .withIndex("by_submission", (x) => x.eq("submission_id", sub.submission_id))
    .collect();
  const draftBy = new Map(drafts.map((x) => [x.question_id, x]));

  let auto = 0;
  let hasEssay = false;
  for (const q of qs) {
    const draft = draftBy.get(q.question_id);
    const raw = answerMap.has(q.question_id)
      ? answerMap.get(q.question_id)
      : draft?.answer;
    let fields: {
      answer: string;
      is_correct: boolean | null;
      score: number | null;
    };
    if (q.type === "pilihan_ganda") {
      const idx =
        raw === undefined || raw === null || String(raw).trim() === ""
          ? -1
          : Math.floor(Number(raw));
      const valid = idx >= 0 && idx < q.options.length;
      const correct = valid && idx === q.correct_index;
      const score = correct ? q.points : 0;
      auto += score;
      fields = {
        answer: valid ? String(idx) : "",
        is_correct: correct,
        score,
      };
    } else {
      hasEssay = true;
      fields = {
        answer: String(raw ?? "").slice(0, LIMITS.essayAnswer),
        is_correct: null,
        score: null,
      };
    }
    if (draft) await ctx.db.patch(draft._id, fields);
    else
      await ctx.db.insert("answers", {
        answer_id: randomId("ANS"),
        submission_id: sub.submission_id,
        question_id: q.question_id,
        feedback: "",
        ...fields,
      });
  }
  const now = Date.now();
  await ctx.db.patch(sub._id, {
    status: hasEssay ? "diserahkan" : "dinilai",
    submitted_at: now,
    auto_score: round2(auto),
    manual_score: hasEssay ? null : 0,
    total_score: hasEssay ? null : round2(auto),
    max_score: maxScoreOf(qs),
    graded_by: hasEssay ? "" : "sistem",
    graded_at: hasEssay ? null : now,
    updated_at: nowIso(),
  });
  return hasEssay;
}

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
      const answer = String(raw).slice(0, type === "esai" ? LIMITS.essayAnswer : 10);
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

/** Dijadwalkan oleh startTask: menutup pengerjaan yang waktunya habis tanpa dikumpulkan. */
export const autoCloseSubmission = internalMutation({
  args: { submissionId: v.string() },
  // Tipe kembalian eksplisit: fungsi ini menjadwalkan dirinya sendiri lewat `internal`
  handler: async (ctx, { submissionId }): Promise<void> => {
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_submission_id", (q) => q.eq("submission_id", submissionId))
      .unique();
    if (!sub || sub.status !== "berlangsung") return;
    const a = await ctx.db
      .query("assignments")
      .withIndex("by_assignment_id", (q) =>
        q.eq("assignment_id", sub.assignment_id),
      )
      .unique();
    if (!a) return;
    const deadline = deadlineOf(a, sub);
    if (!deadline) return; // tenggat/durasi sudah dihapus guru
    const closeAt = deadline + GRACE_MS;
    if (Date.now() < closeAt) {
      // Guru memperpanjang tenggat setelah dijadwalkan: jadwalkan ulang
      await ctx.scheduler.runAt(
        closeAt,
        internal.assignment.autoCloseSubmission,
        { submissionId },
      );
      return;
    }
    await finalizeSubmission(
      ctx,
      sub,
      await questionsOf(ctx, a.assignment_id),
      new Map(),
    );
  },
});

/**
 * Sekali jalan setelah deploy: jadwalkan penutupan untuk pengerjaan "berlangsung" yang dibuat sebelum patch ini.
 *   npx convex run assignment:scheduleOpenSubmissions
 */
export const scheduleOpenSubmissions = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    let n = 0;
    for (const sub of await ctx.db.query("submissions").collect()) {
      if (sub.status !== "berlangsung") continue;
      const a = await ctx.db
        .query("assignments")
        .withIndex("by_assignment_id", (q) =>
          q.eq("assignment_id", sub.assignment_id),
        )
        .unique();
      const deadline = a ? deadlineOf(a, sub) : 0;
      if (!deadline) continue;
      await ctx.scheduler.runAt(
        deadline + GRACE_MS,
        internal.assignment.autoCloseSubmission,
        { submissionId: sub.submission_id },
      );
      n++;
    }
    return n;
  },
});

export const getMyResult = query({
  args: {
    token: v.string(),
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