import type { Doc } from "./_generated/dataModel";

import { MutationCtx, QueryCtx } from "./_generated/server";
import { fail } from "./errors";
import { sha256Hex } from "./security";

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

export const canAccessClass = (user: Doc<"users">, classId: string) =>
  user.role === "admin" || user.assigned_classes.includes(classId);

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

/** Guru hanya boleh bila ia pengampu pasangan kelas + mapel; admin boleh, asalkan pasangannya terdaftar. */
export async function assertTeaches(
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
