import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { query } from "./_generated/server";
import { assertTeaches, requireAuth } from "./access";
import { fail } from "./errors";
import { buildRow, loadConfig, semesterArg, taskAverages } from "./grades";
import {
  activeMemberIds,
  classById,
  isRealDate,
  round1,
  studentById,
  subjectById,
  todayStr,
  userById,
} from "./lib";
import { MAX_RANGE_DAYS, MAX_REPORT_ROWS, STATUS_FIELD } from "./rules";
import { getSettingsMap } from "./settings";

const reportFilters = v.object({
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  classId: v.optional(v.string()),
});

const subjectReportFilters = v.object({
  startDate: v.string(),
  endDate: v.string(),
  classId: v.string(),
  subjectId: v.string(),
});

type RecapCell = ReturnType<typeof buildRow>;
type RecapSubject = {
  subject_id: string;
  subject_name: string;
  kkm: number;
  components: { key: string; label: string; weight: number }[];
};

/* ---------- dashboard ---------- */

export const getDashboardStats = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token);
    const today = todayStr(0);
    const scope = user.role === "guru" ? new Set(user.assigned_classes) : null;
    const inScope = (classId: string) => !scope || scope.has(classId);

    let totalStudents = 0;
    let totalClasses = 0;
    const classes = await ctx.db.query("classes").collect();
    totalClasses = classes.filter(
      (c) => c.is_active && inScope(c.class_id),
    ).length;
    if (scope) {
      const ids = new Set<string>();
      for (const cid of scope)
        for (const sid of await activeMemberIds(ctx, cid)) ids.add(sid);
      totalStudents = ids.size;
    } else {
      totalStudents = (await ctx.db.query("students").collect()).filter(
        (s) => s.is_active,
      ).length;
    }

    // 7 hari terakhir termasuk hari ini, dibaca dari ringkasan harian (bukan semua baris absensi)
    const from = todayStr(-6);
    const to = todayStr(0);
    const daily = scope
      ? (
          await Promise.all(
            [...scope].map((cid) =>
              ctx.db
                .query("attendance_daily")
                .withIndex("by_class_date", (q) =>
                  q
                    .eq("class_id", cid)
                    .gte("attendance_date", from)
                    .lte("attendance_date", to),
                )
                .collect(),
            ),
          )
        ).flat()
      : await ctx.db
          .query("attendance_daily")
          .withIndex("by_date", (q) =>
            q.gte("attendance_date", from).lte("attendance_date", to),
          )
          .collect();

    const stats = {
      totalStudents,
      totalClasses,
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      persentase: "0" as string | number,
    };
    for (const a of daily) {
      if (a.attendance_date !== today) continue;
      stats.hadir += a.hadir;
      stats.sakit += a.sakit;
      stats.izin += a.izin;
      stats.alpa += a.alpa;
    }
    const total = stats.hadir + stats.sakit + stats.izin + stats.alpa;
    stats.persentase = total > 0 ? ((stats.hadir / total) * 100).toFixed(1) : 0;

    const byDate = new Map<string, { h: number; t: number }>();
    for (const a of daily) {
      const e = byDate.get(a.attendance_date) ?? { h: 0, t: 0 };
      e.h += a.hadir;
      e.t += a.sakit + a.izin + a.alpa;
      byDate.set(a.attendance_date, e);
    }
    const dates = [...byDate.keys()].sort();
    return {
      stats,
      chartData: {
        labels: dates,
        hadir: dates.map((d) => byDate.get(d)!.h),
        tidakHadir: dates.map((d) => byDate.get(d)!.t),
      },
    };
  },
});

/** Ringkasan kelas bimbingan untuk wali kelas: absensi harian, per mapel, dan siswa yang perlu perhatian. */
export const getHomeroomOverview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token);
    const today = todayStr(0);
    const from = todayStr(-6);

    const classes = (await ctx.db.query("classes").collect()).filter(
      (c) => c.is_active && c.homeroom_teacher === user.user_id,
    );

    const result = [];
    for (const cls of classes) {
      const members = new Map<string, { nis: string; full_name: string }>();
      for (const id of await activeMemberIds(ctx, cls.class_id)) {
        const s = await studentById(ctx, id);
        if (s?.is_active)
          members.set(id, { nis: s.nis, full_name: s.full_name });
      }

      // Absensi harian hari ini
      const todayRows = (
        await ctx.db
          .query("attendance")
          .withIndex("by_class_date", (q) =>
            q.eq("class_id", cls.class_id).eq("attendance_date", today),
          )
          .collect()
      ).filter((r) => members.has(r.student_id));
      const count = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
      const attention: {
        student_id: string;
        nis: string;
        full_name: string;
        status: string;
        notes: string;
      }[] = [];
      for (const r of todayRows) {
        const f = STATUS_FIELD[r.status as keyof typeof STATUS_FIELD];
        if (f) count[f]++;
        if (r.status !== "Hadir")
          attention.push({
            student_id: r.student_id,
            ...members.get(r.student_id)!,
            status: r.status,
            notes: r.notes,
          });
      }
      const order = ["Alpa", "Sakit", "Izin"];
      attention.sort(
        (a, b) =>
          order.indexOf(a.status) - order.indexOf(b.status) ||
          a.full_name.localeCompare(b.full_name),
      );
      const marked = new Set(todayRows.map((r) => r.student_id));
      const unmarkedAll = [...members]
        .filter(([id]) => !marked.has(id))
        .map(([student_id, m]) => ({ student_id, full_name: m.full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      // Alpa terbanyak 7 hari terakhir
      const weekRows = await ctx.db
        .query("attendance")
        .withIndex("by_class_date", (q) =>
          q
            .eq("class_id", cls.class_id)
            .gte("attendance_date", from)
            .lte("attendance_date", today),
        )
        .collect();
      const alpaCount = new Map<string, number>();
      for (const r of weekRows)
        if (r.status === "Alpa" && members.has(r.student_id))
          alpaCount.set(r.student_id, (alpaCount.get(r.student_id) ?? 0) + 1);
      const frequentAlpa = [...alpaCount]
        .map(([student_id, n]) => ({
          student_id,
          ...members.get(student_id)!,
          count: n,
        }))
        .sort(
          (a, b) => b.count - a.count || a.full_name.localeCompare(b.full_name),
        )
        .slice(0, 5);

      // Absensi per mata pelajaran hari ini
      const teaching = await ctx.db
        .query("teaching")
        .withIndex("by_class_subject", (q) => q.eq("class_id", cls.class_id))
        .collect();
      const subjects = [];
      for (const t of teaching) {
        const rows = (
          await ctx.db
            .query("subject_attendance")
            .withIndex("by_class_subject_date", (q) =>
              q
                .eq("class_id", cls.class_id)
                .eq("subject_id", t.subject_id)
                .eq("attendance_date", today),
            )
            .collect()
        ).filter((r) => members.has(r.student_id));
        const c = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        for (const r of rows) {
          const f = STATUS_FIELD[r.status as keyof typeof STATUS_FIELD];
          if (f) c[f]++;
        }
        subjects.push({
          subject_id: t.subject_id,
          subject_name: (await subjectById(ctx, t.subject_id))?.name ?? "-",
          teacher: (await userById(ctx, t.teacher_id))?.full_name ?? "-",
          filled: rows.length,
          ...c,
        });
      }
      subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      result.push({
        class_id: cls.class_id,
        class_name: cls.class_name,
        grade_level: cls.grade_level,
        academic_year: cls.academic_year,
        total: members.size,
        daily: { filled: marked.size, ...count },
        attention,
        unmarked: unmarkedAll.slice(0, 8),
        unmarked_count: unmarkedAll.length,
        frequentAlpa,
        subjects,
      });
    }
    return { date: today, classes: result };
  },
});

/* ---------- rekap ---------- */

/** Rekap nilai seluruh siswa aktif satu kelas, semester ganjil dan genap (admin). */
export const getClassGradeRecap = query({
  args: {
    token: v.optional(v.string()),
    classId: v.string(),
    academicYear: v.string(),
  },
  handler: async (ctx, a) => {
    await requireAuth(ctx, a.token, { admin: true });

    const teaching = await ctx.db
      .query("teaching")
      .withIndex("by_class_subject", (q) => q.eq("class_id", a.classId))
      .collect();
    const subjectIds = [...new Set(teaching.map((t) => t.subject_id))];

    const students = [];
    for (const id of await activeMemberIds(ctx, a.classId)) {
      const s = await studentById(ctx, id);
      if (s && s.is_active) students.push(s);
    }
    students.sort((x, y) => x.full_name.localeCompare(y.full_name));

    const subjects: RecapSubject[] = [];
    const cells = new Map<string, { ganjil?: RecapCell; genap?: RecapCell }>();
    for (const subjectId of subjectIds) {
      const cfg = await loadConfig(ctx, a.classId, subjectId);
      subjects.push({
        subject_id: subjectId,
        subject_name: (await subjectById(ctx, subjectId))?.name ?? "-",
        kkm: cfg.kkm,
        components: cfg.components.map((c) => ({
          key: c.key,
          label: c.label,
          weight: c.weight,
        })),
      });
      for (const semester of ["ganjil", "genap"] as const) {
        const { averages } = await taskAverages(
          ctx,
          a.classId,
          subjectId,
          a.academicYear,
          semester,
        );
        const scores = await ctx.db
          .query("grade_scores")
          .withIndex("by_cell", (q) =>
            q
              .eq("class_id", a.classId)
              .eq("subject_id", subjectId)
              .eq("academic_year", a.academicYear)
              .eq("semester", semester),
          )
          .collect();
        const manual = new Map<string, Record<string, number>>();
        for (const s of scores) {
          const m = manual.get(s.student_id) ?? {};
          m[s.component] = s.score;
          manual.set(s.student_id, m);
        }
        for (const s of students) {
          const key = `${s.student_id}|${subjectId}`;
          const cur = cells.get(key) ?? {};
          cur[semester] = buildRow(
            cfg,
            averages.get(s.student_id),
            manual.get(s.student_id),
          );
          cells.set(key, cur);
        }
      }
    }
    subjects.sort((x, y) => x.subject_name.localeCompare(y.subject_name));

    return {
      subjects,
      students: students.map((s) => ({
        student_id: s.student_id,
        nis: s.nis,
        full_name: s.full_name,
        grades: subjects.map((sub) => {
          const c = cells.get(`${s.student_id}|${sub.subject_id}`);
          return {
            subject_id: sub.subject_id,
            ganjil: c?.ganjil ?? null,
            genap: c?.genap ?? null,
          };
        }),
      })),
    };
  },
});

/** Daftar nilai satu siswa untuk semua kelas yang pernah ditempati (admin). */
export const getStudentGrades = query({
  args: { token: v.optional(v.string()), studentId: v.string() },
  handler: async (ctx, { token, studentId }) => {
    await requireAuth(ctx, token, { admin: true });
    const student = await studentById(ctx, studentId);
    if (!student) fail("Data siswa tidak ditemukan.");

    const hist = (
      await ctx.db
        .query("student_class_history")
        .withIndex("by_student", (q) => q.eq("student_id", studentId))
        .collect()
    ).sort((x, y) => y.start_date.localeCompare(x.start_date));

    const seen = new Set<string>();
    const periods = [];
    for (const h of hist) {
      const key = `${h.class_id}|${h.academic_year}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cls = await classById(ctx, h.class_id);
      const teaching = await ctx.db
        .query("teaching")
        .withIndex("by_class_subject", (q) => q.eq("class_id", h.class_id))
        .collect();

      const subjects = [];
      for (const subjectId of new Set(teaching.map((t) => t.subject_id))) {
        const cfg = await loadConfig(ctx, h.class_id, subjectId);
        const cells: Partial<Record<"ganjil" | "genap", RecapCell>> = {};
        for (const semester of ["ganjil", "genap"] as const) {
          const { averages } = await taskAverages(
            ctx,
            h.class_id,
            subjectId,
            h.academic_year,
            semester,
          );
          const scores = await ctx.db
            .query("grade_scores")
            .withIndex("by_cell", (q) =>
              q
                .eq("class_id", h.class_id)
                .eq("subject_id", subjectId)
                .eq("academic_year", h.academic_year)
                .eq("semester", semester)
                .eq("student_id", studentId),
            )
            .collect();
          const manual: Record<string, number> = {};
          for (const s of scores) manual[s.component] = s.score;
          cells[semester] = buildRow(cfg, averages.get(studentId), manual);
        }
        subjects.push({
          subject_id: subjectId,
          subject_name: (await subjectById(ctx, subjectId))?.name ?? "-",
          kkm: cfg.kkm,
          components: cfg.components.map((c) => ({
            key: c.key,
            label: c.label,
            weight: c.weight,
          })),
          ganjil: cells.ganjil ?? null,
          genap: cells.genap ?? null,
        });
      }
      subjects.sort((x, y) => x.subject_name.localeCompare(y.subject_name));

      periods.push({
        class_id: h.class_id,
        class_name: cls?.class_name ?? "-",
        grade_level: cls?.grade_level ?? "",
        academic_year: h.academic_year,
        is_active: h.is_active,
        subjects,
      });
    }

    return {
      student: {
        student_id: student!.student_id,
        nis: student!.nis,
        full_name: student!.full_name,
      },
      periods,
    };
  },
});

/* ---------- laporan ---------- */

/** Data rapor satu siswa per semester. Siswa: dirinya sendiri. Admin: siapa saja. Guru: hanya wali kelas siswa itu. */
export const getReportCard = query({
  args: {
    token: v.optional(v.string()),
    studentId: v.optional(v.string()),
    academicYear: v.string(),
    semester: semesterArg,
  },
  handler: async (ctx, a) => {
    const user = await requireAuth(ctx, a.token, { allowStudent: true });
    const studentId = user.role === "siswa" ? user.student_id : a.studentId;
    if (!studentId) fail("Pilih siswa terlebih dahulu.");

    const student = await studentById(ctx, studentId!);
    if (!student) fail("Data siswa tidak ditemukan.");

    const hist = await ctx.db
      .query("student_class_history")
      .withIndex("by_student", (q) => q.eq("student_id", studentId!))
      .collect();
    const h =
      hist.find((x) => x.academic_year === a.academicYear) ??
      hist.find((x) => x.is_active);
    if (!h) fail("Siswa tidak memiliki kelas pada tahun ajaran ini.");
    const cls = await classById(ctx, h!.class_id);
    if (!cls) fail("Kelas tidak ditemukan.");
    if (user.role === "guru" && cls!.homeroom_teacher !== user.user_id)
      fail("FORBIDDEN");

    const teaching = await ctx.db
      .query("teaching")
      .withIndex("by_class_subject", (q) => q.eq("class_id", cls!.class_id))
      .collect();
    const rows = [];
    for (const subjectId of new Set(teaching.map((t) => t.subject_id))) {
      const cfg = await loadConfig(ctx, cls!.class_id, subjectId);
      const { averages } = await taskAverages(
        ctx,
        cls!.class_id,
        subjectId,
        a.academicYear,
        a.semester,
      );
      const scores = await ctx.db
        .query("grade_scores")
        .withIndex("by_cell", (q) =>
          q
            .eq("class_id", cls!.class_id)
            .eq("subject_id", subjectId)
            .eq("academic_year", a.academicYear)
            .eq("semester", a.semester)
            .eq("student_id", studentId!),
        )
        .collect();
      const manual: Record<string, number> = {};
      for (const s of scores) manual[s.component] = s.score;
      const r = buildRow(cfg, averages.get(studentId!), manual);
      rows.push({
        subject_id: subjectId,
        subject_name: (await subjectById(ctx, subjectId))?.name ?? "-",
        kkm: cfg.kkm,
        final: r.final,
        predicate: r.predicate,
        passed: r.passed,
        complete: r.complete,
      });
    }
    rows.sort((x, y) => x.subject_name.localeCompare(y.subject_name));

    const wali = cls!.homeroom_teacher
      ? await userById(ctx, cls!.homeroom_teacher)
      : null;
    const settings = await getSettingsMap(ctx);

    return {
      school: {
        name: settings.school_name,
        address: settings.school_address,
        principal_name: settings.principal_name,
        principal_nip: settings.principal_nip,
      },
      student: {
        full_name: student!.full_name,
        nis: student!.nis,
        nisn: student!.nisn,
      },
      class: {
        class_name: cls!.class_name,
        grade_level: cls!.grade_level,
        academic_year: cls!.academic_year,
      },
      academicYear: a.academicYear,
      semester: a.semester,
      homeroom: wali ? { name: wali.full_name, nip: wali.nip } : null,
      rows,
      printed_at: todayStr(0),
    };
  },
});

export const getReportData = query({
  args: {
    token: v.string(),
    filters: reportFilters,
  },
  handler: async (ctx, { token, filters }) => {
    const user = await requireAuth(ctx, token);
    // Validasi bentuk tanggal dulu: Date.parse("sampah") = NaN akan lolos dari cek rentang
    if (
      (filters.startDate && !isRealDate(filters.startDate)) ||
      (filters.endDate && !isRealDate(filters.endDate))
    )
      fail("Format tanggal tidak valid.");
    if (filters.startDate && filters.endDate) {
      const days =
        (Date.parse(filters.endDate) - Date.parse(filters.startDate)) /
          86_400_000 +
        1;
      if (days < 1) fail("Tanggal awal tidak boleh melebihi tanggal akhir.");
      if (days > MAX_RANGE_DAYS)
        fail(`Rentang maksimal ${MAX_RANGE_DAYS} hari.`);
    }
    const f = (filters ?? {}) as Record<string, unknown>;
    const start = String(f.startDate ?? "") || "0000-00-00";
    const end = String(f.endDate ?? "") || "9999-99-99";
    const classId = String(f.classId ?? "");

    // Kelas yang boleh dilihat: guru = kelas diampu; admin = semua (atau kelas terpilih)
    let classIds: string[] | null =
      user.role === "guru" ? user.assigned_classes : null;
    if (classId)
      classIds = classIds ? classIds.filter((c) => c === classId) : [classId];

    const rows: Doc<"attendance">[] = [];
    const collect = async (cid: string | null) => {
      const q = cid
        ? ctx.db
            .query("attendance")
            .withIndex("by_class_date", (x) =>
              x
                .eq("class_id", cid)
                .gte("attendance_date", start)
                .lte("attendance_date", end),
            )
        : ctx.db
            .query("attendance")
            .withIndex("by_date", (x) =>
              x.gte("attendance_date", start).lte("attendance_date", end),
            );
      const part = await q.take(MAX_REPORT_ROWS + 1 - rows.length);
      rows.push(...part);
      if (rows.length > MAX_REPORT_ROWS)
        fail(
          `Data terlalu banyak (lebih dari ${MAX_REPORT_ROWS} baris). Persempit rentang tanggal atau pilih kelas.`,
        );
    };
    if (classIds) for (const cid of classIds) await collect(cid);
    else await collect(null);

    const studentName = new Map<string, Doc<"students"> | null>();
    const className = new Map<string, string>();
    const out = [];
    for (const a of rows) {
      if (!studentName.has(a.student_id))
        studentName.set(a.student_id, await studentById(ctx, a.student_id));
      if (!className.has(a.class_id))
        className.set(
          a.class_id,
          (await classById(ctx, a.class_id))?.class_name ??
            "Kelas Tidak Ditemukan",
        );
      const s = studentName.get(a.student_id);
      out.push({
        date: a.attendance_date || "-",
        student_name: s?.full_name || "Siswa Tidak Ditemukan",
        nis: s?.nis || "-",
        class_name: className.get(a.class_id)!,
        status: a.status || "-",
        notes: a.notes || "-",
      });
    }
    out.sort(
      (x, y) =>
        x.date.localeCompare(y.date) ||
        x.student_name.localeCompare(y.student_name),
    );
    return { data: out };
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
    for (const id of await activeMemberIds(ctx, classId)) bucket(id);

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
