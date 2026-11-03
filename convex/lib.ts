import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/** Pesan di ConvexError sampai ke klien; error biasa disembunyikan Convex di production. */
export function fail(message: string): never {
  throw new ConvexError(message);
}

/* ---------- waktu ---------- */

// Zona waktu sekolah sebagai selisih menit dari UTC (WIB = 420). Atur lewat env TZ_OFFSET_MINUTES.
const tzOffsetMs = () => Number(process.env.TZ_OFFSET_MINUTES ?? 420) * 60_000;

export const nowIso = () => new Date().toISOString();

/** Tanggal hari ini (yyyy-MM-dd) menurut zona waktu sekolah, digeser `offsetDays` hari. */
export function todayStr(offsetDays = 0) {
  return new Date(Date.now() + tzOffsetMs() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** 'yyyy-MM-ddTHH:mm' (waktu sekolah) -> epoch ms; 0 jika kosong/tidak valid. */
export function dueMs(dueAt: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dueAt || "");
  if (!m) return 0;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - tzOffsetMs();
  return Number.isFinite(ms) ? ms : 0;
}

export function isRealDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/* ---------- kripto ---------- */

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export const PBKDF2_ITERATIONS = 100_000;

export async function pbkdf2Hex(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { 
      name: "PBKDF2", 
      hash: "SHA-256", 
      salt: enc.encode(salt), 
      iterations: PBKDF2_ITERATIONS 
    },
    key,
    256,
  );
  return toHex(bits);
}

export const randomId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
export const randomSalt = () => crypto.randomUUID().replace(/-/g, "");
export const randomToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Hash baru (pbkdf2) untuk password. */
export async function newHash(password: string) {
  const salt = randomSalt();
  return { 
    password_salt: salt, 
    password_hash: await pbkdf2Hex(password, salt), 
    hash_algo: "pbkdf2" as const 
  };
}

/* ---------- kebijakan password kuat (sama dengan frontend: password-policy.ts) ---------- */

const COMMON = [
  "password", "passw0rd", "qwerty", "qwertyuiop", "asdfgh", "zxcvbn", "letmein", "welcome",
  "iloveyou", "abc123", "123456", "12345678", "111111", "000000",
  "admin", "guru", "siswa", "sekolah", "rahasia", "bismillah", "indonesia",
];
const tokensOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);

/** Pesan pelanggaran kebijakan password kuat yang pertama, atau null jika lolos. */
export function passwordIssue(pw: string, forbidden: (string | undefined | null)[] = []): string | null {
  if (pw.length < 8) return "Password minimal 8 karakter.";
  if (pw.length > 100) return "Password maksimal 100 karakter.";
  if (!/[a-z]/.test(pw)) return "Password harus mengandung huruf kecil.";
  if (!/[A-Z]/.test(pw)) return "Password harus mengandung huruf besar.";
  if (!/[0-9]/.test(pw)) return "Password harus mengandung angka.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password harus mengandung simbol, misalnya !@#$%.";
  const low = pw.toLowerCase();
  if (/(.)\1{3,}/.test(pw) || COMMON.some((c) => low.includes(c))) return "Password terlalu umum atau mudah ditebak.";
  const personal = forbidden.flatMap((f) => {
    const t = String(f ?? "");
    const whole = t.toLowerCase().replace(/\s+/g, "");
    return [...tokensOf(t), ...(whole.length >= 3 ? [whole] : [])];
  });
  if (personal.some((t) => low.includes(t))) return "Password tidak boleh memuat username, nama, NIP, atau data pribadi lain.";
  return null;
}

export function assertStrongPassword(pw: string, forbidden: (string | undefined | null)[] = []) {
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

export async function requireAuth(ctx: QueryCtx, token: string, opts: AuthOpts = {}): Promise<Doc<"users">> {
  if (!token) fail("AUTH_FAILED");
  const tokenHash = await sha256Hex(token);
  const sess = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token_hash", tokenHash))
    .unique();
  if (!sess || sess.expires_at < Date.now()) fail("AUTH_FAILED");
  const user = await ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("user_id", sess!.user_id))
    .unique();
  if (!user || !user.is_active) fail("AUTH_FAILED");
  if (user!.must_change_password && !opts.allowPending) fail("MUST_CHANGE_PASSWORD");
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
    assigned_classes: JSON.stringify(u.assigned_classes),
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
    assigned_classes: JSON.stringify(u.assigned_classes), 
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

export function strip<T extends { _id: unknown; _creationTime: number }>(doc: T): Omit<T, "_id" | "_creationTime"> {
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