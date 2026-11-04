import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  classById, 
  fail, 
  isRealDate, 
  nowIso, 
  randomId, 
  requireAuth, 
  studentById, 
  todayStr,
} from "./lib";
import { getSettingsMap } from "./settings";
import { LIMITS, needsNotes } from "./limits"

const STATUSES = ["Hadir", "Sakit", "Izin", "Alpa"];
const MAX_REPORT_ROWS = 10_000;

const attendanceRow = v.object({
  student_id: v.string(),
  status: v.string(),
  notes: v.string(),
});
const reportFilters = v.object({
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  classId: v.optional(v.string()),
});
const myFilters = v.object({
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
});

/** Cerminan assertAttendanceEditable lama: format/nilai tanggal, tanggal masa depan, jendela edit guru. */
async function assertAttendanceEditable(ctx: QueryCtx, user: Doc<"users">, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Format tanggal tidak valid.");
  if (!isRealDate(date)) fail("Tanggal tidak valid.");
  if (date > todayStr(0)) fail("Tidak dapat mengisi absensi untuk tanggal yang akan datang.");
  if (user.role === "admin") return;
  const days = Number((await getSettingsMap(ctx)).edit_window_days) || 0;
  if (days > 0 && date < todayStr(-days)) {
    fail(`Absensi tanggal ${date} sudah dikunci. Guru hanya dapat mengisi atau mengubah absensi maksimal ${days} hari ke belakang.`);
  }
}

async function activeMembers(ctx: QueryCtx, classId: string) {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_class", (q) => q.eq("class_id", classId))
    .collect();
  return [...new Set(hist.filter((h) => h.is_active).map((h) => h.student_id))];
}

/* ---------- form absensi ---------- */

export const getAttendanceForm = query({
  args: { token: v.string(), date: v.string(), classId: v.string() },
  handler: async (ctx, { token, date, classId }) => {
    const user = await requireAuth(ctx, token);
    if (!isRealDate(date)) fail("Format tanggal tidak valid.");
    if (user.role === "guru" && !user.assigned_classes.includes(classId)) fail("Anda tidak memiliki akses ke kelas ini.");

    const ids = await activeMembers(ctx, classId);
    
    const rows = [];
    for (const id of ids) {
      const s = await studentById(ctx, id);
      if (!s || !s.is_active) continue;
      const a = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("student_id", id).eq("attendance_date", date))
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

export const submitAttendanceBatch = mutation({
  args: { 
    token: v.string(), 
    date: v.string(), 
    classId: v.string(), 
    rows: v.array(attendanceRow) },
  handler: async (ctx, { token, date, classId, rows }) => {
    const user = await requireAuth(ctx, token);
    await assertAttendanceEditable(ctx, user, date);
    if (user.role === "guru" && !user.assigned_classes.includes(classId)) fail("Anda tidak memiliki akses ke kelas ini.");
    if (!(await classById(ctx, classId))) fail("Kelas tidak ditemukan.");

    const members = new Set(await activeMembers(ctx, classId));

    const now = nowIso();
    const seen = new Set<string>();
    let skipped = 0;
    for (const raw of rows as Record<string, unknown>[]) {
      const sid = String(raw?.student_id ?? "");
      const status = String(raw?.status ?? "");
      if (!sid || !members.has(sid) || !STATUSES.includes(status) || seen.has(sid)) { skipped++; continue; }
      seen.add(sid);
      const notes = String(raw.notes ?? "").trim().slice(0, LIMITS.notesMax);
      if (needsNotes(status) && notes.length < LIMITS.notesMin) { skipped++; continue; }
      const ex = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("student_id", sid).eq("attendance_date", date))
        .first();
      if (ex) {
        await ctx.db.patch(ex._id, { 
          status, 
          notes, 
          class_id: classId, 
          recorded_by: user.user_id, 
          updated_at: now 
        });
      } else {
        await ctx.db.insert("attendance", {
          attendance_id: randomId("ATT"), 
          attendance_date: date, 
          student_id: sid, 
          class_id: classId,
          status,
          notes, 
          recorded_by: user.user_id, 
          created_at: now, 
          updated_at: now,
        });
      }
    }
    return { message: "Data absensi berhasil disimpan." + (skipped ? ` ${skipped} baris dilewati (tidak valid).` : "") };
  },
});

/* ---------- dashboard ---------- */

export const getDashboardStats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token);
    const today = todayStr(0);
    const scope = user.role === "guru" ? new Set(user.assigned_classes) : null;
    const inScope = (classId: string) => !scope || scope.has(classId);

    let totalStudents = 0;
    let totalClasses = 0;
    const classes = await ctx.db.query("classes").collect();
    totalClasses = classes.filter((c) => c.is_active && inScope(c.class_id)).length;
    if (scope) {
      const ids = new Set<string>();
      for (const cid of scope) for (const sid of await activeMembers(ctx, cid)) ids.add(sid);
      totalStudents = ids.size;
    } else {
      totalStudents = (await ctx.db.query("students").collect()).filter((s) => s.is_active).length;
    }

    const from = todayStr(-7);
    const to = todayStr(0);
    const recent = (await ctx.db.query("attendance").withIndex("by_date", (q) => q.gte("attendance_date", from).lte("attendance_date", to)).collect()).filter((a) =>
      inScope(a.class_id),
    );

    const stats = { totalStudents, totalClasses, hadir: 0, sakit: 0, izin: 0, alpa: 0, persentase: "0" as string | number };
    for (const a of recent) {
      if (a.attendance_date !== today) continue;
      if (a.status === "Hadir") stats.hadir++;
      else if (a.status === "Sakit") stats.sakit++;
      else if (a.status === "Izin") stats.izin++;
      else if (a.status === "Alpa") stats.alpa++;
    }
    const total = stats.hadir + stats.sakit + stats.izin + stats.alpa;
    stats.persentase = total > 0 ? ((stats.hadir / total) * 100).toFixed(1) : 0;

    const byDate = new Map<string, { h: number; t: number }>();
    for (const a of recent) {
      const e = byDate.get(a.attendance_date) ?? { h: 0, t: 0 };
      if (a.status === "Hadir") e.h++;
      else e.t++;
      byDate.set(a.attendance_date, e);
    }
    const dates = [...byDate.keys()].sort();
    return {
      stats,
      chartData: { labels: dates, hadir: dates.map((d) => byDate.get(d)!.h), tidakHadir: dates.map((d) => byDate.get(d)!.t) },
    };
  },
});

/* ---------- laporan ---------- */

export const getReportData = query({
  args: { token: v.string(), filters: reportFilters },
  handler: async (ctx, { token, filters }) => {
    const user = await requireAuth(ctx, token);
    const f = (filters ?? {}) as Record<string, unknown>;
    const start = String(f.startDate ?? "") || "0000-00-00";
    const end = String(f.endDate ?? "") || "9999-99-99";
    const classId = String(f.classId ?? "");

    // Kelas yang boleh dilihat: guru = kelas diampu; admin = semua (atau kelas terpilih)
    let classIds: string[] | null = user.role === "guru" ? user.assigned_classes : null;
    if (classId) classIds = classIds ? classIds.filter((c) => c === classId) : [classId];

    const rows: Doc<"attendance">[] = [];
    const collect = async (cid: string | null) => {
      const q = cid
        ? ctx.db.query("attendance").withIndex("by_class_date", (x) => x.eq("class_id", cid).gte("attendance_date", start).lte("attendance_date", end))
        : ctx.db.query("attendance").withIndex("by_date", (x) => x.gte("attendance_date", start).lte("attendance_date", end));
      const part = await q.take(MAX_REPORT_ROWS + 1 - rows.length);
      rows.push(...part);
      if (rows.length > MAX_REPORT_ROWS) fail(`Data terlalu banyak (lebih dari ${MAX_REPORT_ROWS} baris). Persempit rentang tanggal atau pilih kelas.`);
    };
    if (classIds) for (const cid of classIds) await collect(cid);
    else await collect(null);

    const studentName = new Map<string, Doc<"students"> | null>();
    const className = new Map<string, string>();
    const out = [];
    for (const a of rows) {
      if (!studentName.has(a.student_id)) studentName.set(a.student_id, await studentById(ctx, a.student_id));
      if (!className.has(a.class_id)) className.set(a.class_id, (await classById(ctx, a.class_id))?.class_name ?? "Kelas Tidak Ditemukan");
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
    out.sort((x, y) => x.date.localeCompare(y.date) || x.student_name.localeCompare(y.student_name));
    return { data: out };
  },
});

/* ---------- kehadiran siswa sendiri ---------- */

export const getMyAttendance = query({
  args: { token: v.string(), filters: myFilters },
  handler: async (ctx, { token, filters }) => {
    const user = await requireAuth(ctx, token, { allowStudent: true });
    if (user.role !== "siswa" || !user.student_id) fail("FORBIDDEN");

    const f = (filters ?? {}) as Record<string, unknown>;
    const start = f.startDate ? String(f.startDate) : "";
    const end = f.endDate ? String(f.endDate) : "";
    if ((start && !isRealDate(start)) || (end && !isRealDate(end))) fail("Format tanggal tidak valid.");

    const student = await studentById(ctx, user.student_id);
    if (!student) fail("Data siswa tidak ditemukan.");

    const hist = await ctx.db.query("student_class_history").withIndex("by_student", (q) => q.eq("student_id", user.student_id)).collect();
    const classNames: string[] = [];
    for (const h of hist.filter((x) => x.is_active)) {
      const c = await classById(ctx, h.class_id);
      if (c) classNames.push(c.class_name);
    }

    const lo = start || "0000-00-00";
    const hi = end || "9999-99-99";
    const recs = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("student_id", user.student_id).gte("attendance_date", lo).lte("attendance_date", hi))
      .order("desc")
      .take(500);
    const todayRec = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("student_id", user.student_id).eq("attendance_date", todayStr(0)))
      .first();

    const summary = { hadir: 0, sakit: 0, izin: 0, alpa: 0, persentase: "0" as string | number };
    for (const a of recs) {
      if (a.status === "Hadir") summary.hadir++;
      else if (a.status === "Sakit") summary.sakit++;
      else if (a.status === "Izin") summary.izin++;
      else if (a.status === "Alpa") summary.alpa++;
    }
    const counted = summary.hadir + summary.sakit + summary.izin + summary.alpa;
    summary.persentase = counted > 0 ? ((summary.hadir / counted) * 100).toFixed(1) : 0;

    const classCache = new Map<string, string>();
    const records = [];
    for (const a of recs) {
      if (!classCache.has(a.class_id)) classCache.set(a.class_id, (await classById(ctx, a.class_id))?.class_name ?? "-");
      records.push({ date: a.attendance_date, status: a.status || "-", notes: a.notes, class_name: classCache.get(a.class_id)! });
    }

    return {
      profile: { full_name: student!.full_name, nis: student!.nis, class_name: classNames.join(", ") || "-" },
      today: todayRec ? { status: todayRec.status, notes: todayRec.notes } : null,
      summary,
      records,
    };
  },
});