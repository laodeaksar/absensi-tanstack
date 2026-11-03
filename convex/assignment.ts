import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
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

const GRACE_MS = 60_000; // toleransi keterlambatan jaringan saat kumpul
const ESSAY_MAX = 5000;

/* ---------- helper ---------- */

async function staff(ctx: QueryCtx, token: string) {
  return requireAuth(ctx, token); // siswa -> FORBIDDEN
}

async function student(ctx: QueryCtx, token: string) {
  const user = await requireAuth(ctx, token, { allowStudent: true });
  if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");
  return user;
}

async function findAssignment(ctx: QueryCtx, id: string) {
  const a = await ctx.db.query("assignments").withIndex("by_assignment_id", (q) => q.eq("assignment_id", id)).unique();
  if (!a) fail("Tugas tidak ditemukan.");
  return a!;
}

async function manageAssignment(ctx: QueryCtx, user: Doc<"users">, id: string) {
  const a = await findAssignment(ctx, id);
  if (!canAccessClass(user, a.class_id)) fail("Anda tidak memiliki akses ke tugas ini.");
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
  (await ctx.db
    .query("questions")
    .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
    .collect())
    .sort((a, b) => a.order_no - b.order_no,
  );

const submissionsOf = (ctx: QueryCtx, assignmentId: string) =>
  ctx.db
    .query("submissions")
    .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
    .collect();

const maxScoreOf = (qs: Doc<"questions">[]) => qs.reduce((t, q) => t + q.points, 0);

/** Batas akhir pengerjaan: yang lebih awal antara tenggat dan (mulai + durasi); 0 = tanpa batas. */
function deadlineOf(a: Doc<"assignments">, sub: { started_at: number }) {
  const due = dueMs(a.due_at);
  const byDuration = a.duration_minutes > 0 ? sub.started_at + a.duration_minutes * 60_000 : 0;
  if (due && byDuration) return Math.min(due, byDuration);
  return due || byDuration;
}

function questionOut(q: Doc<"questions">, forStudent: boolean) {
  const out = {
    question_id: q.question_id, type: q.type, text: q.text, options: q.options, points: q.points, order_no: q.order_no,
  } as Record<string, unknown>;
  // Kunci jawaban tidak pernah dikirim ke siswa
  if (!forStudent) out.correct_index = q.type === "pilihan_ganda" && q.correct_index !== null ? q.correct_index : "";
  return out;
}

async function classNameMap(ctx: QueryCtx) {
  const m = new Map<string, string>();
  for (const c of await ctx.db.query("classes").collect()) m.set(c.class_id, c.class_name);
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
    const all = (await ctx.db.query("assignments").collect()).filter((a) => canAccessClass(user, a.class_id));

    const data = [];
    for (const a of all) {
      const qs = await ctx.db
        .query("questions")
        .withIndex("by_assignment", (q) => q.eq("assignment_id", a.assignment_id))
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
  args: { token: v.string(), data: v.any() },
  handler: async (ctx, { token, data }) => {
    const user = await staff(ctx, token);
    if (!data || typeof data !== "object") fail("Data tugas tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const title = String(d.title ?? "").trim();
    const description = String(d.description ?? "").trim();
    if (!title) fail("Judul wajib diisi.");
    if (title.length > 150) fail("Judul maksimal 150 karakter.");
    if (description.length > 1000) fail("Deskripsi maksimal 1000 karakter.");

    const classId = String(d.class_id ?? "");
    const cls = await classById(ctx, classId);
    if (!cls || !cls.is_active) fail("Kelas tidak valid.");
    if (!canAccessClass(user, classId)) fail("Anda tidak memiliki akses ke kelas ini.");

    const dueAt = String(d.due_at ?? "").trim();
    if (dueAt && !dueMs(dueAt)) fail("Format tenggat tidak valid.");

    const duration = Math.floor(Number(d.duration_minutes ?? 0));
    if (!Number.isFinite(duration) || duration < 0 || duration > 600) fail("Durasi harus 0 sampai 600 menit.");

    const publish = d.is_published === true || d.is_published === "true";
    const existing = d.assignment_id ? await manageAssignment(ctx, user, String(d.assignment_id)) : null;
    const now = nowIso();

    if (publish) {
      const count = existing ? (await questionsOf(ctx, existing.assignment_id)).length : 0;
      if (count === 0) fail("Tambahkan minimal satu soal sebelum mempublikasikan tugas.");
    }

    if (existing) {
      if (existing.class_id !== classId && (await submissionsOf(ctx, existing.assignment_id)).length > 0) {
        fail("Kelas tidak dapat diubah karena tugas sudah dikerjakan siswa.");
      }
      await ctx.db.patch(existing._id, {
        title, description, class_id: classId, due_at: dueAt, duration_minutes: duration, is_published: publish, updated_at: now,
      });
      return { message: "Tugas diperbarui.", assignment_id: existing.assignment_id };
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
      assignment_id: id 
    };
  },
});

export const deleteAssignment = mutation({
  args: { token: v.string(), assignmentId: v.string() },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);

    for (const s of await submissionsOf(ctx, assignmentId)) {
      for (const ans of await ctx.db.query("answers").withIndex("by_submission", (q) => q.eq("submission_id", s.submission_id)).collect()) {
        await ctx.db.delete(ans._id);
      }
      await ctx.db.delete(s._id);
    }
    for (const q of await questionsOf(ctx, assignmentId)) await ctx.db.delete(q._id);
    await ctx.db.delete(a._id);
    return { message: "Tugas beserta soal dan jawaban siswa dihapus." };
  },
});

export const getAssignmentDetail = query({
  args: { token: v.string(), assignmentId: v.string() },
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

/* ==========================================
 * B. GURU / ADMIN - SOAL
 * ========================================== */

const LOCKED_MSG = "Tugas sudah dikerjakan siswa, soal tidak dapat ditambah, diubah, atau dihapus.";

export const saveQuestion = mutation({
  args: { token: v.string(), data: v.any() },
  handler: async (ctx, { token, data }) => {
    const user = await staff(ctx, token);
    if (!data || typeof data !== "object") fail("Data soal tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const a = await manageAssignment(ctx, user, String(d.assignment_id ?? ""));
    if ((await submissionsOf(ctx, a.assignment_id)).length > 0) fail(LOCKED_MSG);

    const type = String(d.type ?? "");
    if (type !== "pilihan_ganda" && type !== "esai") fail("Tipe soal tidak valid.");
    const text = String(d.text ?? "").trim();
    if (!text) fail("Pertanyaan wajib diisi.");
    if (text.length > 2000) fail("Pertanyaan maksimal 2000 karakter.");
    const points = Number(d.points);
    if (!Number.isInteger(points) || points < 1 || points > 100) fail("Poin harus bilangan bulat 1 sampai 100.");

    let options: string[] = [];
    let correct: number | null = null;
    if (type === "pilihan_ganda") {
      options = (Array.isArray(d.options) ? d.options : []).map((o) => String(o).trim());
      if (options.length < 2 || options.length > 6) fail("Pilihan jawaban harus 2 sampai 6.");
      const seen = new Set<string>();
      for (const o of options) {
        if (!o) fail("Semua pilihan jawaban wajib diisi.");
        if (o.length > 300) fail("Pilihan jawaban maksimal 300 karakter.");
        if (seen.has(o.toLowerCase())) fail("Ada pilihan jawaban yang sama.");
        seen.add(o.toLowerCase());
      }
      const c = Number(d.correct_index);
      if (!Number.isInteger(c) || c < 0 || c >= options.length) fail("Pilih satu jawaban yang benar.");
      correct = c;
    }

    const now = nowIso();
    const qType = type as "pilihan_ganda" | "esai";

    if (d.question_id) {
      const q = await ctx.db.query("questions").withIndex("by_question_id", (x) => x.eq("question_id", String(d.question_id))).unique();
      if (!q || q.assignment_id !== a.assignment_id) fail("Soal tidak ditemukan.");
      await ctx.db.patch(q!._id, { 
        type: qType, 
        text, 
        options, 
        correct_index: correct, 
        points, 
        updated_at: now 
      });
      return { message: "Soal diperbarui." };
    }

    const maxOrder = (await questionsOf(ctx, a.assignment_id)).reduce((m, q) => Math.max(m, q.order_no), 0);
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
  args: { token: v.string(), questionId: v.string() },
  handler: async (ctx, { token, questionId }) => {
    const user = await staff(ctx, token);
    const q = await ctx.db.query("questions").withIndex("by_question_id", (x) => x.eq("question_id", questionId)).unique();
    if (!q) fail("Soal tidak ditemukan.");
    const a = await manageAssignment(ctx, user, q!.assignment_id);
    if ((await submissionsOf(ctx, a.assignment_id)).length > 0) fail(LOCKED_MSG);

    await ctx.db.delete(q!._id);
    // Tugas tanpa soal tidak boleh tetap terbit
    if (a.is_published && (await questionsOf(ctx, a.assignment_id)).length === 0) {
      await ctx.db.patch(a._id, { 
        is_published: false, 
        updated_at: nowIso() 
      });
    }
    return { message: "Soal dihapus." };
  },
});

/* ==========================================
 * C. GURU / ADMIN - PENGUMPULAN & PENILAIAN
 * ========================================== */

export const listSubmissions = query({
  args: { token: v.string(), assignmentId: v.string() },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await staff(ctx, token);
    const a = await manageAssignment(ctx, user, assignmentId);
    const max = maxScoreOf(await questionsOf(ctx, assignmentId));
    const subBy = new Map((await submissionsOf(ctx, assignmentId)).map((s) => [s.student_id, s]));
    const ids = new Set([...(await activeMemberIds(ctx, a.class_id)), ...subBy.keys()]); // siswa pindah kelas tetap terlihat

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
        score: finished ? num(sub!.total_score) : partial ? num(sub!.auto_score) : "",
        max_score: max,
        nilai: finished && max > 0 ? round1((num(sub!.total_score) / max) * 100) : "",
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
        max_score: max 
      },
      data: rows,
    };
  },
});

export const getSubmissionForReview = query({
  args: { token: v.string(), submissionId: v.string() },
  handler: async (ctx, { token, submissionId }) => {
    const user = await staff(ctx, token);
    const sub = await findSubmission(ctx, submissionId);
    const a = await manageAssignment(ctx, user, sub.assignment_id);
    if (sub.status !== "diserahkan" && sub.status !== "dinilai") fail("Siswa belum mengumpulkan tugas ini.");

    const st = await studentById(ctx, sub.student_id);
    const answers = await ctx.db.query("answers").withIndex("by_submission", (q) => q.eq("submission_id", sub.submission_id)).collect();
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
        nis: st?.nis || "-" 
      },
      assignment: { 
        assignment_id: a.assignment_id, 
        title: a.title, 
        class_name: classes.get(a.class_id) ?? "-" 
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
  args: { token: v.string(), submissionId: v.string(), grades: v.array(v.any()) },
  handler: async (ctx, { token, submissionId, grades }) => {
    const user = await staff(ctx, token);
    const sub = await findSubmission(ctx, submissionId);
    const a = await manageAssignment(ctx, user, sub.assignment_id);
    if (sub.status !== "diserahkan" && sub.status !== "dinilai") fail("Siswa belum mengumpulkan tugas ini.");

    const qs = await questionsOf(ctx, a.assignment_id);
    const gradeMap = new Map<string, Record<string, unknown>>();
    for (const g of grades as Record<string, unknown>[]) if (g && g.question_id) gradeMap.set(String(g.question_id), g);

    // Validasi semua dulu, baru tulis
    const parsed = new Map<string, { score: number; feedback: string }>();
    for (const q of qs.filter((x) => x.type === "esai")) {
      const no = qs.indexOf(q) + 1;
      const g = gradeMap.get(q.question_id);
      const raw = g && g.score !== undefined && g.score !== null ? String(g.score).trim().replace(",", ".") : "";
      if (raw === "") fail(`Nilai soal esai nomor ${no} belum diisi.`);
      const sc = Number(raw);
      if (!Number.isFinite(sc) || sc < 0 || sc > q.points) fail(`Nilai soal nomor ${no} harus 0 sampai ${q.points}.`);
      const fb = String(g!.feedback ?? "").trim();
      if (fb.length > 500) fail("Komentar maksimal 500 karakter.");
      parsed.set(q.question_id, { score: round2(sc), feedback: fb });
    }

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_submission", (x) => x.eq("submission_id", sub.submission_id))
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
      if (ans) await ctx.db.patch(ans._id, { score: p.score, feedback: p.feedback });
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
    return { message: "Penilaian disimpan. Nilai kini terlihat oleh siswa." };
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
    const assignments = (await ctx.db.query("assignments").collect()).filter((a) => a.is_published && mine.has(a.class_id));

    const data = [];
    for (const a of assignments) {
      const qs = await questionsOf(ctx, a.assignment_id);
      const sub = await ctx.db
        .query("submissions")
        .withIndex("by_assignment_student", (q) => q.eq("assignment_id", a.assignment_id).eq("student_id", user.student_id))
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
        nilai: finished && max > 0 ? round1((num(sub!.total_score) / max) * 100) : "",
        created_at: a.created_at,
      });
    }
    data.sort((x, y) => y.created_at.localeCompare(x.created_at));
    return { data };
  },
});

/** Simpan jawaban + hitung nilai. Dipakai submitTask dan penutupan otomatis saat waktu habis. */
async function finalizeSubmission(
  ctx: MutationCtx,
  sub: Doc<"submissions">,
  qs: Doc<"questions">[],
  answerMap: Map<string, unknown>,
) {
  let auto = 0;
  let hasEssay = false;
  for (const q of qs) {
    const raw = answerMap.get(q.question_id);
    if (q.type === "pilihan_ganda") {
      const idx = raw === undefined || raw === null || String(raw).trim() === "" ? -1 : Math.floor(Number(raw));
      const valid = idx >= 0 && idx < q.options.length;
      const correct = valid && idx === q.correct_index;
      const score = correct ? q.points : 0;
      auto += score;
      await ctx.db.insert("answers", {
        answer_id: randomId("ANS"), 
        submission_id: sub.submission_id,
        question_id: q.question_id,
        answer: valid ? String(idx) : "",
        is_correct: correct, 
        score, 
        feedback: "",
      });
    } else {
      hasEssay = true;
      await ctx.db.insert("answers", {
        answer_id: randomId("ANS"),
        submission_id: sub.submission_id,
        question_id: q.question_id,
        answer: String(raw ?? "").slice(0, ESSAY_MAX), 
        is_correct: null, 
        score: null, 
        feedback: "",
      });
    }
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
  args: { token: v.string(), assignmentId: v.string() },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    if (!a.is_published || !(await myClassIds(ctx, user.student_id)).includes(a.class_id)) fail("Tugas tidak tersedia.");
    const qs = await questionsOf(ctx, a.assignment_id);
    if (qs.length === 0) fail("Tugas belum memiliki soal.");

    const now = Date.now();
    let sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) => q.eq("assignment_id", a.assignment_id).eq("student_id", user.student_id))
      .unique();

    if (sub && sub.status !== "berlangsung") fail("Tugas ini sudah dikumpulkan.");

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
    }

    const deadline = deadlineOf(a, sub);
    if (deadline && now > deadline + GRACE_MS) {
      // Waktu habis tanpa kumpul. Catatan: perubahan di sini ikut dibatalkan bila kita melempar error,
      // jadi penutupan dilakukan lalu hasilnya dikembalikan sebagai pesan, bukan exception.
      await finalizeSubmission(ctx, sub, qs, new Map());
      return { 
        closed: true as const, 
        message: "Waktu mengerjakan sudah habis. Tugas ditutup otomatis." 
      };
    }

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
    };
  },
});

export const submitTask = mutation({
  args: { token: v.string(), assignmentId: v.string(), answers: v.array(v.any()) },
  handler: async (ctx, { token, assignmentId, answers }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) => q.eq("assignment_id", a.assignment_id).eq("student_id", user.student_id))
      .unique();
    if (!sub) fail("Anda belum memulai tugas ini.");
    if (sub!.status !== "berlangsung") fail("Tugas ini sudah dikumpulkan.");

    const qs = await questionsOf(ctx, a.assignment_id);
    const deadline = deadlineOf(a, sub!);
    if (deadline && Date.now() > deadline + GRACE_MS) {
      await finalizeSubmission(ctx, sub!, qs, new Map());
      return { 
        status: "diserahkan" as const, 
        closed: true, 
        message: "Waktu mengerjakan sudah habis. Jawaban tidak dapat dikumpulkan." 
      };
    }

    const map = new Map<string, unknown>();
    for (const x of answers as Record<string, unknown>[]) if (x && x.question_id) map.set(String(x.question_id), x.answer);
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

export const getMyResult = query({
  args: { token: v.string(), assignmentId: v.string() },
  handler: async (ctx, { token, assignmentId }) => {
    const user = await student(ctx, token);
    const a = await findAssignment(ctx, assignmentId);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_assignment_student", (q) => q.eq("assignment_id", a.assignment_id).eq("student_id", user.student_id))
      .unique();
    if (!sub) fail("Anda belum mengerjakan tugas ini.");
    if (sub!.status === "berlangsung") fail("Tugas belum dikumpulkan.");

    const base = { title: a.title, status: sub!.status } as Record<string, unknown>;
    if (sub!.status !== "dinilai") return base; // belum ada nilai untuk ditampilkan

    const qs = await questionsOf(ctx, a.assignment_id);
    const answers = await ctx.db.query("answers").withIndex("by_submission", (q) => q.eq("submission_id", sub!.submission_id)).collect();
    const max = maxScoreOf(qs);
    const mcq = { correct: 0, total: 0, score: 0, max: 0 };
    const essay = { total: 0, score: 0, max: 0 };
    const feedbacks: { no: number; points: number; score: number; text: string }[] = [];

    qs.forEach((q, i) => {
      const ans = answers.find((x) => x.question_id === q.question_id);
      if (q.type === "pilihan_ganda") {
        mcq.total++; mcq.max += q.points;
        if (ans?.is_correct) mcq.correct++;
        mcq.score += ans?.score ?? 0;
      } else {
        essay.total++; essay.max += q.points;
        essay.score += ans?.score ?? 0;
        feedbacks.push({ no: i + 1, points: q.points, score: ans?.score ?? 0, text: ans?.feedback ?? "" });
      }
    });

    const total = num(sub!.total_score);
    return {
      ...base,
      score: total, 
      max_score: max, 
      nilai: max > 0 ? round1((total / max) * 100) : 0,
      mcq: { ...mcq,
      score: round2(mcq.score) }, 
      essay: { ...essay, 
      score: round2(essay.score) }, 
      feedbacks,
    };
  },
});