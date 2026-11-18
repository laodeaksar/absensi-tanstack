// Kompatibilitas: impor lama dari "./lib" tetap berfungsi
/* export { fail } from "./errors";
export * from "./access";
export * from "./security"; */

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

export const randomId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
export const flag = (x: unknown) => x === true || x === "true" || x === "TRUE";

/* ---------- waktu ---------- */

// Zona waktu sekolah sebagai selisih menit dari UTC (WIB = 420). Atur lewat env TZ_OFFSET_MINUTES.
export const tzOffsetMinutes = () =>
  Number(process.env.TZ_OFFSET_MINUTES ?? 420);
const tzOffsetMs = () => tzOffsetMinutes() * 60_000;

export const nowIso = () => new Date().toISOString();

/** Tanggal hari ini (yyyy-MM-dd) menurut zona waktu sekolah, digeser `offsetDays` hari. */
export function todayStr(offsetDays = 0) {
  return new Date(Date.now() + tzOffsetMs() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** 'yyyy-MM-ddTHH:mm' (waktu sekolah) -> epoch ms; 0 jika kosong/tidak valid. */
export function dueMs(dueAt: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dueAt || "");
  if (!m) return 0;
  if (+m[4] > 23 || +m[5] > 59 || !isRealDate(`${m[1]}-${m[2]}-${m[3]}`))
    return 0;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - tzOffsetMs();
  return Number.isFinite(ms) ? ms : 0;
}

export function isRealDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  );
}

/* ---------- bentuk keluaran (kompatibel dengan frontend) ---------- */

export function sessionUser(u: Doc<"users">) {
  return {
    user_id: u.user_id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    assigned_classes: u.assigned_classes,
    student_id: u.student_id,
    must_change_password: u.must_change_password,
  };
}

export function teacherOut(u: Doc<"users">) {
  return {
    user_id: u.user_id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    assigned_classes: u.assigned_classes,
    is_active: u.is_active,
    nip: u.nip,
    phone: u.phone,
    email: u.email,
    student_id: u.student_id,
    must_change_password: u.must_change_password,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

export function strip<
  T extends {
    _id: unknown;
    _creationTime: number;
  },
>(doc: T): Omit<T, "_id" | "_creationTime"> {
  const { _id, _creationTime, ...rest } = doc;
  void _id;
  void _creationTime;
  return rest;
}

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Helper kecil agar query berdasarkan ID string ringkas. */
export async function classById(ctx: QueryCtx, classId: string) {
  return ctx.db
    .query("classes")
    .withIndex("by_class_id", (q) => q.eq("class_id", classId))
    .unique();
}
export async function studentById(ctx: QueryCtx, studentId: string) {
  return ctx.db
    .query("students")
    .withIndex("by_student_id", (q) => q.eq("student_id", studentId))
    .unique();
}
export async function userById(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("user_id", userId))
    .unique();
}

/* ---------- mata pelajaran dan guru pengampu ---------- */

export async function subjectById(ctx: QueryCtx, subjectId: string) {
  return ctx.db
    .query("subjects")
    .withIndex("by_subject_id", (q) => q.eq("subject_id", subjectId))
    .unique();
}

/**
 * Satu-satunya definisi "anggota kelas": siswa dengan riwayat kelas aktif.
 * Invarian: siswa nonaktif tidak punya riwayat aktif (lihat closeActiveHistory di master.ts),
 * jadi tidak perlu memeriksa students.is_active lagi di sini.
 */
export async function activeMemberIds(
  ctx: QueryCtx,
  classId: string,
): Promise<string[]> {
  const hist = await ctx.db
    .query("student_class_history")
    .withIndex("by_class", (q) => q.eq("class_id", classId))
    .collect();
  return [...new Set(hist.filter((h) => h.is_active).map((h) => h.student_id))];
}
