import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { mutation, query } from "./_generated/server";
import { requireAuth, teachingRowOf } from "./access";
import { fail } from "./errors";
import {
  classById,
  nowIso,
  randomId,
  strip,
  subjectById,
  userById,
} from "./lib";
import { LIMITS } from "./limits";
import { RULES } from "./rules";

// Semua opsional: tombol Aktif/Nonaktifkan hanya mengirim { subject_id, is_active }
const subjectInput = v.object({
  subject_id: v.optional(v.string()),
  code: v.optional(v.string()),
  name: v.optional(v.string()),
  is_active: v.optional(v.boolean()),
});

const teachingInput = v.object({
  teaching_id: v.optional(v.string()),
  class_id: v.string(),
  subject_id: v.string(),
  teacher_id: v.string(),
});

/* ---------- mata pelajaran ---------- */

export const listSubjects = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token); // siswa -> FORBIDDEN
    const rows = await ctx.db.query("subjects").collect();
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { data: rows.map(strip) };
  },
});

export const saveSubject = mutation({
  args: { token: v.string(), data: subjectInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    const d = data as Record<string, unknown>;

    const id = String(d.subject_id ?? "");
    const existing = id ? await subjectById(ctx, id) : null;
    if (id && !existing) fail("Mata pelajaran tidak ditemukan.");

    const code = String(d.code ?? existing?.code ?? "")
      .trim()
      .toUpperCase();
    const name = String(d.name ?? existing?.name ?? "").trim();
    if (!RULES.subjectCode.test(code))
      fail(
        `Kode harus 2-${LIMITS.subjectCodeMax} karakter (huruf, angka, titik, minus, garis bawah).`,
      );
    if (name.length < 2) fail("Nama mata pelajaran minimal 2 karakter.");
    if (name.length > LIMITS.subjectName)
      fail(`Nama mata pelajaran maksimal ${LIMITS.subjectName} karakter.`);

    const all = await ctx.db.query("subjects").collect();
    if (all.some((s) => s.subject_id !== id && s.code === code))
      fail("Kode mata pelajaran sudah dipakai.");
    if (
      all.some(
        (s) =>
          s.subject_id !== id && s.name.toLowerCase() === name.toLowerCase(),
      )
    )
      fail("Nama mata pelajaran sudah ada.");

    const nextActive =
      typeof d.is_active === "boolean"
        ? d.is_active
        : (existing?.is_active ?? true);
    const now = nowIso();
    if (existing) {
      await ctx.db.patch(existing._id, {
        code,
        name,
        is_active: nextActive,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("subjects", {
        subject_id: randomId("SUB"),
        code,
        name,
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }
    return { message: "Mata pelajaran berhasil disimpan." };
  },
});

export const deleteSubject = mutation({
  args: { token: v.string(), subjectId: v.string() },
  handler: async (ctx, { token, subjectId }) => {
    await requireAuth(ctx, token, { admin: true });
    const s = await subjectById(ctx, subjectId);
    if (!s) fail("Mata pelajaran tidak ditemukan.");

    const used =
      (await ctx.db
        .query("teaching")
        .withIndex("by_subject", (q) => q.eq("subject_id", subjectId))
        .first()) ||
      (await ctx.db
        .query("assignments")
        .withIndex("by_subject", (q) => q.eq("subject_id", subjectId))
        .first()) ||
      (await ctx.db
        .query("subject_attendance")
        .withIndex("by_subject", (q) => q.eq("subject_id", subjectId))
        .first());
    if (used)
      fail(
        "Mata pelajaran sudah dipakai (pengampu, tugas, atau absensi). Nonaktifkan saja agar tidak muncul di pilihan baru.",
      );
    await ctx.db.delete(s._id);
    return { message: "Mata pelajaran dihapus." };
  },
});

/* ---------- guru pengampu ---------- */

/** Admin: semua baris. Guru: hanya baris miliknya (dipakai form tugas dan absensi mapel). */
export const listTeaching = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token);
    const rows =
      user.role === "admin"
        ? await ctx.db.query("teaching").collect()
        : await ctx.db
            .query("teaching")
            .withIndex("by_teacher", (q) => q.eq("teacher_id", user.user_id))
            .collect();

    const classes = new Map(
      (await ctx.db.query("classes").collect()).map((c) => [c.class_id, c]),
    );
    const subjects = new Map(
      (await ctx.db.query("subjects").collect()).map((s) => [s.subject_id, s]),
    );
    const teachers = new Map<string, Doc<"users"> | null>();
    for (const t of rows)
      if (!teachers.has(t.teacher_id))
        teachers.set(t.teacher_id, await userById(ctx, t.teacher_id));

    const data = rows.map((t) => {
      const c = classes.get(t.class_id);
      const s = subjects.get(t.subject_id);
      const g = teachers.get(t.teacher_id);
      return {
        teaching_id: t.teaching_id,
        class_id: t.class_id,
        class_name: c?.class_name ?? "-",
        class_active: !!c?.is_active,
        subject_id: t.subject_id,
        subject_code: s?.code ?? "-",
        subject_name: s?.name ?? "-",
        subject_active: !!s?.is_active,
        teacher_id: t.teacher_id,
        teacher_name: g?.full_name ?? "-",
        teacher_active: !!g?.is_active,
      };
    });
    data.sort(
      (a, b) =>
        a.class_name.localeCompare(b.class_name) ||
        a.subject_name.localeCompare(b.subject_name),
    );
    return { data };
  },
});

export const saveTeaching = mutation({
  args: { token: v.string(), data: teachingInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    const d = data as Record<string, unknown>;

    const id = String(d.teaching_id ?? "");
    const existing = id
      ? await ctx.db
          .query("teaching")
          .withIndex("by_teaching_id", (q) => q.eq("teaching_id", id))
          .unique()
      : null;
    if (id && !existing) fail("Data pengampu tidak ditemukan.");

    const classId = String(d.class_id ?? "");
    const subjectId = String(d.subject_id ?? "");
    const teacherId = String(d.teacher_id ?? "");
    // Kelas dan mapel tidak diubah saat edit: tugas dan absensi terikat pada pasangan ini
    if (
      existing &&
      (existing.class_id !== classId || existing.subject_id !== subjectId)
    )
      fail(
        "Kelas dan mata pelajaran tidak dapat diubah. Hapus lalu buat pengampu baru.",
      );

    const cls = await classById(ctx, classId);
    if (!cls || (!existing && !cls.is_active)) fail("Kelas tidak valid.");
    const subject = await subjectById(ctx, subjectId);
    if (!subject || (!existing && !subject.is_active))
      fail("Mata pelajaran tidak valid.");

    const teacher = await userById(ctx, teacherId);
    const changedTeacher = teacherId !== existing?.teacher_id;
    if (
      !teacher ||
      teacher.role !== "guru" ||
      (changedTeacher && !teacher.is_active)
    )
      fail("Guru pengampu tidak valid.");

    // Guru hanya bisa ditugaskan di kelas yang ia ampu ("Kelas yang diampu"), karena akses tugas
    // dan absensinya mengikuti daftar itu. Dicek untuk penugasan baru atau saat guru diganti,
    // supaya baris lama yang kelasnya sudah dicabut tetap bisa disimpan.
    if (
      (!existing || changedTeacher) &&
      !(teacher?.assigned_classes ?? []).includes(classId)
    )
      fail(
        "Guru ini belum mengampu kelas tersebut. Tambahkan kelasnya di data guru.",
      );

    const dup = await teachingRowOf(ctx, classId, subjectId);
    if (dup && dup.teaching_id !== id)
      fail(
        "Mata pelajaran ini sudah punya guru pengampu di kelas tersebut. Ubah baris yang ada.",
      );

    const now = nowIso();
    if (existing) {
      await ctx.db.patch(existing._id, {
        teacher_id: teacherId,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("teaching", {
        teaching_id: randomId("TCH"),
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        created_at: now,
        updated_at: now,
      });
    }
    return { message: "Guru pengampu berhasil disimpan." };
  },
});

export const deleteTeaching = mutation({
  args: { token: v.string(), teachingId: v.string() },
  handler: async (ctx, { token, teachingId }) => {
    await requireAuth(ctx, token, { admin: true });
    const row = await ctx.db
      .query("teaching")
      .withIndex("by_teaching_id", (q) => q.eq("teaching_id", teachingId))
      .unique();
    if (!row) fail("Data pengampu tidak ditemukan.");

    const tasks = (
      await ctx.db
        .query("assignments")
        .withIndex("by_class", (q) => q.eq("class_id", row.class_id))
        .collect()
    ).filter((a) => a.subject_id === row.subject_id).length;
    await ctx.db.delete(row._id);
    return {
      message:
        "Guru pengampu dihapus." +
        (tasks
          ? ` ${tasks} tugas mapel ini kini hanya dapat dikelola admin.`
          : ""),
    };
  },
});
