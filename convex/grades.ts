import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { type QueryCtx, mutation, query } from "./_generated/server";
import {
  canTeach,
  fail,
  nowIso,
  requireAuth,
  round2,
  studentById,
  subjectById,
  teachingRowOf,
} from "./lib";
import { LIMITS } from "./limits";
import {
  DEFAULT_GRADE_COMPONENTS,
  DEFAULT_KKM,
  type GradeComponent,
  finalScore,
  periodFor,
  predicateFor,
} from "./rules";
import { getSettingsMap } from "./settings";

const semesterArg = v.union(v.literal("ganjil"), v.literal("genap"));

async function assertCanGrade(
  ctx: QueryCtx,
  user: Doc<"users">,
  classId: string,
  subjectId: string,
) {
  if (!(await canTeach(ctx, user, classId, subjectId))) fail("FORBIDDEN");
}

async function loadConfig(ctx: QueryCtx, classId: string, subjectId: string) {
  const row = await ctx.db
    .query("grade_configs")
    .withIndex("by_class_subject", (q) =>
      q.eq("class_id", classId).eq("subject_id", subjectId),
    )
    .unique();
  return row
    ? { kkm: row.kkm, components: row.components, saved: true }
    : { kkm: DEFAULT_KKM, components: DEFAULT_GRADE_COMPONENTS, saved: false };
}

async function activeStudentIds(ctx: QueryCtx, classId: string) {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_class", (q) => q.eq("class_id", classId))
    .collect();
  return new Set(hist.filter((h) => h.is_active).map((h) => h.student_id));
}

/** Rata-rata persentase tugas yang sudah dinilai, per siswa, untuk kelas, mapel, dan semester. */
async function taskAverages(
  ctx: QueryCtx,
  classId: string,
  subjectId: string,
  academicYear: string,
  semester: string,
) {
  const s = await getSettingsMap(ctx);
  const all = await ctx.db
    .query("assignments")
    .withIndex("by_subject", (q) => q.eq("subject_id", subjectId))
    .collect();
  // Tugas masuk ke semester menurut tanggal tenggatnya (tanggal dibuat bila tanpa tenggat)
  const inPeriod = all.filter((a) => {
    if (a.class_id !== classId || !a.is_published) return false;
    const p = periodFor(
      (a.due_at || a.created_at).slice(0, 10),
      s.semester_ganjil_start,
      s.semester_genap_start,
    );
    return p.academicYear === academicYear && p.semester === semester;
  });
  const acc = new Map<string, { sum: number; n: number }>();
  for (const a of inPeriod) {
    const subs = await ctx.db
      .query("submissions")
      .withIndex("by_assignment", (q) => q.eq("assignment_id", a.assignment_id))
      .collect();
    for (const sub of subs) {
      if (
        sub.status !== "dinilai" ||
        sub.total_score === null ||
        sub.max_score <= 0
      )
        continue;
      const cur = acc.get(sub.student_id) ?? { sum: 0, n: 0 };
      cur.sum += (sub.total_score / sub.max_score) * 100;
      cur.n += 1;
      acc.set(sub.student_id, cur);
    }
  }
  const averages = new Map<string, number>();
  for (const [id, { sum, n }] of acc) averages.set(id, round2(sum / n));
  return { averages, count: inPeriod.length };
}

function buildRow(
  cfg: { kkm: number; components: GradeComponent[] },
  tugas: number | undefined,
  manual: Record<string, number> | undefined,
) {
  const values: Record<string, number | null> = {};
  for (const c of cfg.components)
    values[c.key] =
      c.source === "tugas" ? (tugas ?? null) : (manual?.[c.key] ?? null);
  const f = finalScore(cfg.components, values);
  return {
    values,
    final: f.final,
    complete: f.complete,
    predicate: f.final === null ? "" : predicateFor(f.final, cfg.kkm),
    passed: f.final !== null && f.final >= cfg.kkm,
  };
}

/** Blokir bila ada mapel yang belum memenuhi KKM pada semester ganjil dan genap. */
export async function assertMeetsKkm(
  ctx: QueryCtx,
  studentId: string,
  classId: string,
  academicYear: string,
  action: string,
) {
  const teaching = await ctx.db
    .query("teaching")
    .withIndex("by_class_subject", (q) => q.eq("class_id", classId))
    .collect();
  const subjectIds = [...new Set(teaching.map((t) => t.subject_id))];

  const problems: string[] = [];
  for (const subjectId of subjectIds) {
    const cfg = await loadConfig(ctx, classId, subjectId);
    const failed: string[] = [];
    for (const semester of ["ganjil", "genap"] as const) {
      const { averages } = await taskAverages(
        ctx,
        classId,
        subjectId,
        academicYear,
        semester,
      );
      const scores = await ctx.db
        .query("grade_scores")
        .withIndex("by_cell", (q) =>
          q
            .eq("class_id", classId)
            .eq("subject_id", subjectId)
            .eq("academic_year", academicYear)
            .eq("semester", semester)
            .eq("student_id", studentId),
        )
        .collect();
      const manual: Record<string, number> = {};
      for (const s of scores) manual[s.component] = s.score;
      const r = buildRow(cfg, averages.get(studentId), manual);
      // nilai belum lengkap dianggap belum memenuhi KKM
      if (!(r.complete && r.passed)) failed.push(semester);
    }
    if (failed.length)
      problems.push(
        `${(await subjectById(ctx, subjectId))?.name ?? subjectId} (${failed.join(", ")})`,
      );
  }

  if (problems.length)
    fail(
      `Belum bisa ${action}. Nilai belum memenuhi KKM: ${problems.join("; ")}.`,
    );
}

/** Buku nilai satu kelas, mapel, dan semester (admin atau guru pengampu). */
export const getGradeBook = query({
  args: {
    token: v.optional(v.string()),
    classId: v.string(),
    subjectId: v.string(),
    academicYear: v.string(),
    semester: semesterArg,
  },
  handler: async (ctx, a) => {
    const user = await requireAuth(ctx, a.token);
    await assertCanGrade(ctx, user, a.classId, a.subjectId);
    const cfg = await loadConfig(ctx, a.classId, a.subjectId);

    const students = [];
    for (const id of await activeStudentIds(ctx, a.classId)) {
      const s = await studentById(ctx, id);
      if (s && s.is_active) students.push(s);
    }
    students.sort((x, y) => x.full_name.localeCompare(y.full_name));

    const scores = await ctx.db
      .query("grade_scores")
      .withIndex("by_cell", (q) =>
        q
          .eq("class_id", a.classId)
          .eq("subject_id", a.subjectId)
          .eq("academic_year", a.academicYear)
          .eq("semester", a.semester),
      )
      .collect();
    const manual = new Map<string, Record<string, number>>();
    for (const s of scores) {
      const m = manual.get(s.student_id) ?? {};
      m[s.component] = s.score;
      manual.set(s.student_id, m);
    }
    const { averages, count } = await taskAverages(
      ctx,
      a.classId,
      a.subjectId,
      a.academicYear,
      a.semester,
    );

    return {
      config: cfg,
      task_count: count,
      rows: students.map((s) => ({
        student_id: s.student_id,
        nis: s.nis,
        full_name: s.full_name,
        ...buildRow(cfg, averages.get(s.student_id), manual.get(s.student_id)),
      })),
    };
  },
});

const componentInput = v.object({
  key: v.string(),
  label: v.string(),
  weight: v.number(),
  source: v.union(v.literal("tugas"), v.literal("manual")),
});

/** KKM dan komponen bobot per kelas dan mapel (admin atau guru pengampu). */
export const saveGradeConfig = mutation({
  args: {
    token: v.optional(v.string()),
    classId: v.string(),
    subjectId: v.string(),
    kkm: v.number(),
    components: v.array(componentInput),
  },
  handler: async (ctx, { token, classId, subjectId, kkm, components }) => {
    const user = await requireAuth(ctx, token);
    await assertCanGrade(ctx, user, classId, subjectId);
    if (!(await teachingRowOf(ctx, classId, subjectId)))
      fail("Mata pelajaran ini belum diampu di kelas tersebut.");
    if (!Number.isFinite(kkm) || kkm < 0 || kkm > 100)
      fail("KKM harus antara 0 dan 100.");
    if (components.length < 1 || components.length > LIMITS.maxComponents)
      fail(`Jumlah komponen harus 1 sampai ${LIMITS.maxComponents}.`);

    const keys = new Set<string>();
    const clean: GradeComponent[] = [];
    let total = 0;
    let tugasCount = 0;
    for (const c of components) {
      const label = c.label.trim();
      if (!label || label.length > 30)
        fail("Nama komponen wajib diisi (maksimal 30 karakter).");
      if (!(c.weight > 0 && c.weight <= 100))
        fail(`Bobot "${label}" harus lebih dari 0 dan maksimal 100.`);
      const key = c.source === "tugas" ? "tugas" : c.key.trim().toLowerCase();
      if (
        c.source === "manual" &&
        (!/^[a-z0-9_]{1,20}$/.test(key) || key === "tugas")
      )
        fail(`Kunci komponen "${label}" tidak valid.`);
      if (keys.has(key)) fail(`Komponen "${label}" ganda.`);
      keys.add(key);
      if (c.source === "tugas") tugasCount++;
      total += c.weight;
      clean.push({ key, label, weight: c.weight, source: c.source });
    }
    if (tugasCount > 1) fail("Komponen tugas otomatis hanya boleh satu.");
    if (Math.abs(total - 100) > 0.001)
      fail(`Total bobot harus 100 (sekarang ${total}).`);

    const existing = await ctx.db
      .query("grade_configs")
      .withIndex("by_class_subject", (q) =>
        q.eq("class_id", classId).eq("subject_id", subjectId),
      )
      .unique();
    const doc = {
      kkm,
      components: clean,
      updated_by: user.user_id,
      updated_at: nowIso(),
    };
    if (existing) await ctx.db.patch(existing._id, doc);
    else
      await ctx.db.insert("grade_configs", {
        class_id: classId,
        subject_id: subjectId,
        ...doc,
      });
    return null;
  },
});

/** Simpan nilai komponen manual. score null = hapus nilai. */
export const saveScores = mutation({
  args: {
    token: v.optional(v.string()),
    classId: v.string(),
    subjectId: v.string(),
    academicYear: v.string(),
    semester: semesterArg,
    entries: v.array(
      v.object({
        studentId: v.string(),
        component: v.string(),
        score: v.union(v.number(), v.null()),
      }),
    ),
  },
  handler: async (ctx, a) => {
    const user = await requireAuth(ctx, a.token);
    await assertCanGrade(ctx, user, a.classId, a.subjectId);
    if (a.entries.length > 600) fail("Terlalu banyak data sekaligus.");
    const cfg = await loadConfig(ctx, a.classId, a.subjectId);
    const manual = new Set(
      cfg.components.filter((c) => c.source === "manual").map((c) => c.key),
    );
    const inClass = await activeStudentIds(ctx, a.classId);
    const now = nowIso();

    for (const e of a.entries) {
      if (!manual.has(e.component)) fail("Komponen nilai tidak valid.");
      if (!inClass.has(e.studentId)) fail("Siswa tidak berada di kelas ini.");
      if (e.score !== null && !(e.score >= 0 && e.score <= 100))
        fail("Nilai harus antara 0 dan 100.");
      const existing = await ctx.db
        .query("grade_scores")
        .withIndex("by_cell", (q) =>
          q
            .eq("class_id", a.classId)
            .eq("subject_id", a.subjectId)
            .eq("academic_year", a.academicYear)
            .eq("semester", a.semester)
            .eq("student_id", e.studentId)
            .eq("component", e.component),
        )
        .unique();
      if (e.score === null) {
        if (existing) await ctx.db.delete(existing._id);
        continue;
      }
      const doc = {
        score: round2(e.score),
        updated_by: user.user_id,
        updated_at: now,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else
        await ctx.db.insert("grade_scores", {
          class_id: a.classId,
          subject_id: a.subjectId,
          academic_year: a.academicYear,
          semester: a.semester,
          student_id: e.studentId,
          component: e.component,
          ...doc,
        });
    }
    return null;
  },
});

/** Nilai siswa yang sedang login, per mata pelajaran di kelasnya. */
export const getMyGrades = query({
  args: {
    token: v.optional(v.string()),
    academicYear: v.string(),
    semester: semesterArg,
  },
  handler: async (ctx, { token, academicYear, semester }) => {
    const user = await requireAuth(ctx, token, { allowStudent: true });
    if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");
    const studentId = user.student_id;

    const hist = (
      await ctx.db
        .query("student_class_history")
        .withIndex("by_student", (q) => q.eq("student_id", studentId))
        .collect()
    ).filter((h) => h.is_active);

    const rows = [];
    for (const h of hist) {
      const teaching = await ctx.db
        .query("teaching")
        .withIndex("by_class_subject", (q) => q.eq("class_id", h.class_id))
        .collect();
      for (const t of teaching) {
        const cfg = await loadConfig(ctx, h.class_id, t.subject_id);
        const { averages } = await taskAverages(
          ctx,
          h.class_id,
          t.subject_id,
          academicYear,
          semester,
        );
        const scores = await ctx.db
          .query("grade_scores")
          .withIndex("by_cell", (q) =>
            q
              .eq("class_id", h.class_id)
              .eq("subject_id", t.subject_id)
              .eq("academic_year", academicYear)
              .eq("semester", semester)
              .eq("student_id", studentId),
          )
          .collect();
        const manual: Record<string, number> = {};
        for (const s of scores) manual[s.component] = s.score;
        const r = buildRow(cfg, averages.get(studentId), manual);
        rows.push({
          subject_id: t.subject_id,
          subject_name: (await subjectById(ctx, t.subject_id))?.name ?? "-",
          kkm: cfg.kkm,
          components: cfg.components.map((c) => ({
            key: c.key,
            label: c.label,
            weight: c.weight,
            value: r.values[c.key] ?? null,
          })),
          final: r.final,
          complete: r.complete,
          predicate: r.predicate,
          passed: r.passed,
        });
      }
    }
    rows.sort((x, y) => x.subject_name.localeCompare(y.subject_name));
    return { rows };
  },
});
