import { ConvexError } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { passwordIssue } from "./rules";

// export { passwordIssue };

/** Pesan di ConvexError sampai ke klien; error biasa disembunyikan Convex di production. */
export function fail(message: string): never {
  throw new ConvexError(message);
}

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

/* ---------- kripto ---------- */

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Iterasi hash lama (akun tanpa hash_iterations). JANGAN diubah: hash lama bergantung padanya. */
export const PBKDF2_LEGACY_ITERATIONS = 100_000;
/** Iterasi untuk hash baru. Boleh dinaikkan kapan saja; hash lama tetap diverifikasi dengan nilainya sendiri. */
export const PBKDF2_ITERATIONS = 100_000; // naikkan ke 600_000 pada langkah 2 (lihat urutan rilis)

export async function pbkdf2Hex(
  password: string,
  salt: string,
  iterations = PBKDF2_LEGACY_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(salt),
      iterations,
    },
    key,
    256,
  );
  return toHex(bits);
}

/** Hash baru (pbkdf2) untuk password; mencatat jumlah iterasinya. */
export async function newHash(password: string) {
  const salt = randomSalt();
  return {
    password_salt: salt,
    password_hash: await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS),
    hash_algo: "pbkdf2" as const,
    hash_iterations: PBKDF2_ITERATIONS,
  };
}

/** Cocokkan password dengan hash pbkdf2 milik pengguna, memakai iterasi yang tersimpan. */
export async function verifyPbkdf2(
  user: Pick<
    Doc<"users">,
    "password_salt" | "password_hash" | "hash_iterations"
  >,
  password: string,
) {
  const iterations = user.hash_iterations ?? PBKDF2_LEGACY_ITERATIONS;
  return safeEqual(
    await pbkdf2Hex(password, user.password_salt, iterations),
    user.password_hash,
  );
}

/** true bila hash pbkdf2 pengguna masih memakai iterasi di bawah target. */
export const needsRehash = (
  user: Pick<Doc<"users">, "hash_algo" | "hash_iterations">,
) =>
  user.hash_algo === "pbkdf2" &&
  (user.hash_iterations ?? PBKDF2_LEGACY_ITERATIONS) < PBKDF2_ITERATIONS;

export const randomId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
export const randomSalt = () => crypto.randomUUID().replace(/-/g, "");
export const randomToken = () =>
  (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- kebijakan password kuat (sama dengan frontend: password-policy.ts) ---------- */

export function assertStrongPassword(
  pw: string,
  forbidden: (string | undefined | null)[] = [],
) {
  const issue = passwordIssue(pw, forbidden);
  if (issue) fail(issue);
}

/* ---------- autentikasi ---------- */

export interface AuthOpts {
  admin?: boolean;
  allowStudent?: boolean;
  /** izinkan akun yang wajib ganti password */
  allowPending?: boolean;
}

/**
 * `token` diisi = jalur lama (token sesi sebagai argumen, lewat server TanStack Start).
 * `token` kosong = jalur baru: JWT dari ConvexReactClient, klaim `sid` menunjuk ke baris sesi.
 * Sesi tetap dicek di database, jadi pencabutan (ganti password, logout) langsung berlaku.
 */
export async function requireAuth(
  ctx: QueryCtx,
  token: string | undefined,
  opts: AuthOpts = {},
): Promise<Doc<"users">> {
  let sess: Doc<"sessions"> | null = null;
  if (token) {
    const tokenHash = await sha256Hex(token);
    sess = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token_hash", tokenHash))
      .unique();
  } else {
    const identity = await ctx.auth.getUserIdentity();
    const sid = (identity as { sid?: unknown } | null)?.sid;
    const id =
      typeof sid === "string" ? ctx.db.normalizeId("sessions", sid) : null;
    sess = id ? await ctx.db.get(id) : null;
  }
  if (!sess || sess.expires_at < Date.now()) fail("AUTH_FAILED");
  const user = await ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("user_id", sess!.user_id))
    .unique();
  if (!user || !user.is_active) fail("AUTH_FAILED");
  if (user!.must_change_password && !opts.allowPending)
    fail("MUST_CHANGE_PASSWORD");
  if (user!.role === "siswa" && !opts.allowStudent) fail("FORBIDDEN");
  if (opts.admin && user!.role !== "admin") fail("FORBIDDEN");
  return user!;
}

export async function revokeSessions(ctx: MutationCtx, userId: string) {
  const rows = await ctx.db
    .query("sessions")
    .withIndex("by_user", (q) => q.eq("user_id", userId))
    .collect();
  for (const s of rows) await ctx.db.delete(s._id);
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

export const canAccessClass = (user: Doc<"users">, classId: string) =>
  user.role === "admin" || user.assigned_classes.includes(classId);

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

/** Baris pengampu untuk satu pasangan kelas + mata pelajaran (maksimal satu guru). */
export async function teachingRowOf(
  ctx: QueryCtx,
  classId: string,
  subjectId: string,
) {
  return ctx.db
    .query("teaching")
    .withIndex("by_class_subject", (q) =>
      q.eq("class_id", classId).eq("subject_id", subjectId),
    )
    .first();
}

/** Admin boleh semua; guru hanya bila ia pengampu mata pelajaran tersebut di kelas tersebut. */
export async function canTeach(
  ctx: QueryCtx,
  user: Doc<"users">,
  classId: string,
  subjectId: string,
) {
  if (user.role === "admin") return true;
  const row = await teachingRowOf(ctx, classId, subjectId);
  return !!row && row.teacher_id === user.user_id;
}
