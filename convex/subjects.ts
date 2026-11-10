import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import { activeMembers, assertAttendanceEditable } from "./attendance";
import {
  classById,
  fail,
  isRealDate,
  nowIso,
  randomId,
  requireAuth,
  round1,
  strip,
  studentById,
  subjectById,
  teachingRowOf,
  userById,
} from "./lib";
import { LIMITS, needsNotes } from "./limits";
import { MAX_RANGE_DAYS, RULES, STATUS_VALUES } from "./rules";

const MAX_REPORT_ROWS = 10_000;

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

const attendanceRow = v.object({
  student_id: v.string(),
  status: v.string(),
  notes: v.string(),
});

const myRange = v.object({
  startDate: v.string(),
  endDate: v.string(),
});

const subjectReportFilters = v.object({
  startDate: v.string(),
  endDate: v.string(),
  classId: v.string(),
  subjectId: v.string(),
});

/** Guru hanya boleh bila ia pengampu pasangan kelas + mapel; admin boleh, asalkan pasangannya terdaftar. */
async function assertTeaches(
  ctx: QueryCtx,
  user: Doc<"users">,
  classId: string,
  subjectId: string,
) {
  const row = await teachingRowOf(ctx, classId, subjectId);
  if (!row) fail("Mata pelajaran ini belum diampu di kelas tersebut.");
  if (user.role !== "admin" && row.teacher_id !== user.user_id)
    fail("Anda bukan guru pengampu mata pelajaran ini di kelas tersebut.");
  return row;
}

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

/* ---------- absensi per mata pelajaran ---------- */

export const getSubjectAttendanceForm = query({
  args: {
    token: v.string(),
    date: v.string(),
    classId: v.string(),
    subjectId: v.string(),
  },
  handler: async (ctx, { token, date, classId, subjectId }) => {
    const user = await requireAuth(ctx, token);
    if (!isRealDate(date)) fail("Format tanggal tidak valid.");
    await assertTeaches(ctx, user, classId, subjectId);

    const rows = [];
    for (const id of await activeMembers(ctx, classId)) {
      const s = await studentById(ctx, id);
      if (!s || !s.is_active) continue;
      const a = await ctx.db
        .query("subject_attendance")
        .withIndex("by_student_subject_date", (q) =>
          q
            .eq("student_id", id)
            .eq("subject_id", subjectId)
            .eq("attendance_date", date),
        )
        .first();
      rows.push({
        student_id: s.student_id,
        nis: s.nis || "-",
        full_name: s.full_name || "Tanpa Nama",
        status: a ? a.status || "Belum Ada" : "Belum Ada",
        notes: a ? a.notes : "",
        attendance_id: a ? a.attendance_id : null,
      });
    }
    rows.sort((x, y) => x.full_name.localeCompare(y.full_name));
    return { data: rows };
  },
});

export const submitSubjectAttendance = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    classId: v.string(),
    subjectId: v.string(),
    rows: v.array(attendanceRow),
  },
  handler: async (ctx, { token, date, classId, subjectId, rows }) => {
    const user = await requireAuth(ctx, token);
    // Aturan tanggal sama dengan absensi harian: tidak boleh masa depan, jendela edit untuk guru
    await assertAttendanceEditable(ctx, user, date);
    await assertTeaches(ctx, user, classId, subjectId);
    if (!(await classById(ctx, classId))) fail("Kelas tidak ditemukan.");
    const subject = await subjectById(ctx, subjectId);
    if (!subject || !subject.is_active) fail("Mata pelajaran tidak valid.");

    const members = new Set(await activeMembers(ctx, classId));
    const now = nowIso();
    const seen = new Set<string>();
    let skipped = 0;
    for (const raw of rows as Record<string, unknown>[]) {
      const sid = String(raw?.student_id ?? "");
      const status = String(raw?.status ?? "");
      if (
        !sid ||
        !members.has(sid) ||
        !(STATUS_VALUES as readonly string[]).includes(status) ||
        seen.has(sid)
      ) {
        skipped++;
        continue;
      }
      seen.add(sid);
      const notes = String(raw.notes ?? "")
        .trim()
        .slice(0, LIMITS.notesMax);
      if (needsNotes(status) && notes.length < LIMITS.notesMin) {
        skipped++;
        continue;
      }
      const ex = await ctx.db
        .query("subject_attendance")
        .withIndex("by_student_subject_date", (q) =>
          q
            .eq("student_id", sid)
            .eq("subject_id", subjectId)
            .eq("attendance_date", date),
        )
        .first();
      if (ex) {
        await ctx.db.patch(ex._id, {
          status,
          notes,
          class_id: classId,
          recorded_by: user.user_id,
          updated_at: now,
        });
      } else {
        await ctx.db.insert("subject_attendance", {
          attendance_id: randomId("SAT"),
          attendance_date: date,
          class_id: classId,
          subject_id: subjectId,
          student_id: sid,
          status,
          notes,
          recorded_by: user.user_id,
          created_at: now,
          updated_at: now,
        });
      }
    }
    return {
      message:
        "Absensi mata pelajaran berhasil disimpan." +
        (skipped ? ` ${skipped} baris dilewati (tidak valid).` : ""),
    };
  },
});

/** Rekap per siswa untuk satu kelas + mata pelajaran dalam rentang tanggal. */
export const getSubjectReportData = query({
  args: { token: v.string(), filters: subjectReportFilters },
  handler: async (ctx, { token, filters }) => {
    const user = await requireAuth(ctx, token);
    const { startDate, endDate, classId, subjectId } = filters;
    if (!isRealDate(startDate) || !isRealDate(endDate))
      fail("Format tanggal tidak valid.");
    if (startDate > endDate)
      fail("Tanggal mulai tidak boleh setelah tanggal akhir.");
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
    if (days > MAX_RANGE_DAYS)
      fail(`Rentang laporan maksimal ${MAX_RANGE_DAYS} hari.`);
    await assertTeaches(ctx, user, classId, subjectId);

    const records = await ctx.db
      .query("subject_attendance")
      .withIndex("by_class_subject_date", (q) =>
        q
          .eq("class_id", classId)
          .eq("subject_id", subjectId)
          .gte("attendance_date", startDate)
          .lte("attendance_date", endDate),
      )
      .take(MAX_REPORT_ROWS + 1);
    if (records.length > MAX_REPORT_ROWS)
      fail("Data terlalu banyak. Persempit rentang tanggal.");

    type Tally = { hadir: number; sakit: number; izin: number; alpa: number };
    const tally = new Map<string, Tally>();
    const dates = new Set<string>();
    const bucket = (sid: string) => {
      let t = tally.get(sid);
      if (!t) {
        t = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        tally.set(sid, t);
      }
      return t;
    };
    for (const r of records) {
      dates.add(r.attendance_date);
      const t = bucket(r.student_id);
      if (r.status === "Hadir") t.hadir++;
      else if (r.status === "Sakit") t.sakit++;
      else if (r.status === "Izin") t.izin++;
      else if (r.status === "Alpa") t.alpa++;
    }
    // Siswa aktif kelas tanpa data tetap tampil (nol), supaya terlihat siapa yang belum tercatat
    for (const id of await activeMembers(ctx, classId)) bucket(id);

    const data = [];
    for (const [sid, t] of tally) {
      const s = await studentById(ctx, sid);
      const total = t.hadir + t.sakit + t.izin + t.alpa;
      data.push({
        student_id: sid,
        nis: s?.nis || "-",
        full_name: s?.full_name || "Tanpa Nama",
        ...t,
        total,
        persentase: total > 0 ? round1((t.hadir / total) * 100) : 0,
      });
    }
    data.sort((a, b) => a.full_name.localeCompare(b.full_name));

    const cls = await classById(ctx, classId);
    const subject = await subjectById(ctx, subjectId);
    return {
      data,
      meta: {
        class_name: cls?.class_name ?? "-",
        subject_name: subject?.name ?? "-",
        meetings: dates.size,
      },
    };
  },
});

/** Siswa melihat kehadiran per mata pelajaran miliknya sendiri dalam rentang tanggal. */
export const getMySubjectAttendance = query({
  args: { token: v.optional(v.string()), filters: myRange },
  handler: async (ctx, { token, filters }) => {
    const user = await requireAuth(ctx, token, { allowStudent: true });
    if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");
    const sid = user.student_id;

    const { startDate, endDate } = filters;
    if (!isRealDate(startDate) || !isRealDate(endDate))
      fail("Format tanggal tidak valid.");
    if (startDate > endDate)
      fail("Tanggal mulai tidak boleh setelah tanggal akhir.");
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
    if (days > MAX_RANGE_DAYS) fail(`Rentang maksimal ${MAX_RANGE_DAYS} hari.`);

    const recs = await ctx.db
      .query("subject_attendance")
      .withIndex("by_student_date", (q) =>
        q
          .eq("student_id", sid)
          .gte("attendance_date", startDate)
          .lte("attendance_date", endDate),
      )
      .order("desc")
      .take(MAX_REPORT_ROWS + 1);
    if (recs.length > MAX_REPORT_ROWS)
      fail("Data terlalu banyak. Persempit rentang tanggal.");

    const names = new Map(
      (await ctx.db.query("subjects").collect()).map((s) => [
        s.subject_id,
        s.name,
      ]),
    );
    type Tally = { hadir: number; sakit: number; izin: number; alpa: number };
    const tally = new Map<string, Tally>();
    for (const r of recs) {
      let t = tally.get(r.subject_id);
      if (!t) {
        t = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        tally.set(r.subject_id, t);
      }
      if (r.status === "Hadir") t.hadir++;
      else if (r.status === "Sakit") t.sakit++;
      else if (r.status === "Izin") t.izin++;
      else if (r.status === "Alpa") t.alpa++;
    }

    const summary = [...tally].map(([subjectId, t]) => {
      const total = t.hadir + t.sakit + t.izin + t.alpa;
      return {
        subject_id: subjectId,
        subject_name: names.get(subjectId) ?? "-",
        ...t,
        total,
        persentase: total > 0 ? round1((t.hadir / total) * 100) : 0,
      };
    });
    summary.sort((a, b) => a.subject_name.localeCompare(b.subject_name));

    return {
      summary,
      records: recs.map((r) => ({
        date: r.attendance_date,
        subject_name: names.get(r.subject_id) ?? "-",
        status: r.status || "-",
        notes: r.notes,
      })),
    };
  },
});
