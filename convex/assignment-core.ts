import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { fail } from "./errors";
import { dueMs, nowIso, randomId, round2 } from "./lib";
import { LIMITS } from "./limits";

// Helper bersama sisi guru, sisi siswa, dan fungsi terjadwal. Tidak berisi query atau mutation.
export const GRACE_MS = 60_000; // toleransi keterlambatan jaringan saat kumpul

export async function findAssignment(ctx: QueryCtx, id: string) {
  const a = await ctx.db
    .query("assignments")
    .withIndex("by_assignment_id", (q) => q.eq("assignment_id", id))
    .unique();
  if (!a) fail("Tugas tidak ditemukan.");
  return a!;
}

export const questionsOf = async (ctx: QueryCtx, assignmentId: string) =>
  (
    await ctx.db
      .query("questions")
      .withIndex("by_assignment", (q) => q.eq("assignment_id", assignmentId))
      .collect()
  ).sort((a, b) => a.order_no - b.order_no);

export const maxScoreOf = (qs: Doc<"questions">[]) =>
  qs.reduce((t, q) => t + q.points, 0);

/** Batas akhir pengerjaan: yang lebih awal antara tenggat dan (mulai + durasi); 0 = tanpa batas. */
export function deadlineOf(a: Doc<"assignments">, sub: { started_at: number }) {
  const due = dueMs(a.due_at);
  const byDuration =
    a.duration_minutes > 0 ? sub.started_at + a.duration_minutes * 60_000 : 0;
  if (due && byDuration) return Math.min(due, byDuration);
  return due || byDuration;
}

export function questionOut(q: Doc<"questions">, forStudent: boolean) {
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

export async function classNameMap(ctx: QueryCtx) {
  const m = new Map<string, string>();
  for (const c of await ctx.db.query("classes").collect())
    m.set(c.class_id, c.class_name);
  return m;
}

/**
 * Simpan jawaban + hitung nilai. Dipakai submitTask dan penutupan otomatis saat waktu habis.
 * Jawaban yang tidak ada di answerMap diambil dari draf (saveDraft), jadi penutupan otomatis
 * tetap menilai apa yang sudah sempat tersimpan.
 */
export async function finalizeSubmission(
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
