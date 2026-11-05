import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import {
  PBKDF2_ITERATIONS,
  assertStrongPassword,
  fail,
  newHash,
  nowIso,
  pbkdf2Hex,
  randomToken,
  requireAuth,
  revokeSessions,
  safeEqual,
  sessionUser,
  sha256Hex,
  studentById,
  verifyPbkdf2,
  needsRehash,
} from "./lib";
import { LIMITS } from "./limits";
import { passwordIssue } from "./rules";

const MAX_FAILS = 5;
const LOCK_MS = LIMITS.loginLockMs;
const SESSION_MS = 6 * 60 * 60_000;

/** Cocokkan password dengan data pengguna sesuai jenis hash-nya. */
async function verifyPassword(
  ctx: QueryCtx,
  user: Doc<"users">,
  password: string,
): Promise<boolean> {
  if (user.hash_algo === "nisn") {
    // Password awal siswa = NISN pada data siswa (belum pernah diganti)
    const st = user.student_id ? await studentById(ctx, user.student_id) : null;
    return !!st && st.nisn.length >= 6 && safeEqual(st.nisn, password);
  }
  if (user.hash_algo === "sha256") {
    return safeEqual(
      await sha256Hex(password + user.password_salt),
      user.password_hash,
    );
  }
  return verifyPbkdf2(user, password);
}

/** Catat gagal login. Mengembalikan waktu (epoch ms) akun terkunci, atau 0 bila belum terkunci. */
async function recordFailure(
  ctx: MutationCtx,
  key: string,
  now: number,
): Promise<number> {
  const row = await ctx.db
    .query("login_attempts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  // Hitungan direset bila kegagalan terakhir sudah lewat 15 menit
  const fails = row && now - row.last_fail <= LOCK_MS ? row.fails + 1 : 1;
  const patch = {
    fails,
    last_fail: now,
    locked_until: fails >= MAX_FAILS ? now + LOCK_MS : 0,
  };
  if (row) await ctx.db.patch(row._id, patch);
  else
    await ctx.db.insert("login_attempts", {
      key,
      ...patch,
    });
  return patch.locked_until;
}

/**
 * Login. Mengembalikan hasil (bukan melempar error) supaya hitungan gagal login ikut tersimpan:
 * mutation yang melempar error akan membatalkan semua perubahannya.
 */
export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { username, password }) => {
    const denied = (message: string, retryAfterMs = 0) => ({
      ok: false as const,
      message,
      retry_after_ms: retryAfterMs,
    });
    const key = username.trim().toLowerCase();
    const now = Date.now();
    if (!key || key.length > 100 || password.length > 200)
      return denied("Username atau password salah.");

    const attempt = await ctx.db
      .query("login_attempts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (attempt && attempt.locked_until > now) {
      return denied(
        "Terlalu banyak percobaan gagal.",
        attempt.locked_until - now,
      );
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_username_lc", (q) => q.eq("username_lc", key))
      .unique();
    //const valid = !!user && user.is_active && (await verifyPassword(ctx, user, password));
    let valid = false;
    if (user && user.is_active)
      valid = await verifyPassword(ctx, user, password);
    else await pbkdf2Hex(password, "waktu-respons-palsu", PBKDF2_ITERATIONS); // tambahkan PBKDF2_ITERATIONS ke impor
    if (!valid || !user) {
      const lockedUntil = await recordFailure(ctx, key, now);
      return lockedUntil > now
        ? denied("Terlalu banyak percobaan gagal.", lockedUntil - now)
        : denied("Username atau password salah.");
    }

    if (attempt) await ctx.db.delete(attempt._id);

    // Upgrade hash lama (sha256 hasil migrasi, atau pbkdf2 di bawah target iterasi) saat berhasil login
    if (user.hash_algo === "sha256" || needsRehash(user)) {
      await ctx.db.patch(user._id, {
        ...(await newHash(password)),
        updated_at: nowIso(),
      });
    }

    // Akun lama dengan password yang belum memenuhi kebijakan kuat: wajib ganti password mulai login ini.
    // (Akun dengan password awal NISN sudah otomatis wajib ganti.)
    let mustChange = user.must_change_password;
    if (
      !mustChange &&
      user.hash_algo !== "nisn" &&
      passwordIssue(password, [
        user.username,
        user.full_name,
        user.nip,
        user.phone,
      ])
    ) {
      mustChange = true;
      await ctx.db.patch(user._id, {
        must_change_password: true,
        updated_at: nowIso(),
      });
    }

    const token = randomToken();
    await ctx.db.insert("sessions", {
      token_hash: await sha256Hex(token),
      user_id: user.user_id,
      expires_at: now + SESSION_MS,
      created_at: now,
    });
    return {
      ok: true as const,
      token,
      user: {
        ...sessionUser(user),
        must_change_password: mustChange,
      },
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const th = await sha256Hex(token);
    const s = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token_hash", th))
      .unique();
    if (s) await ctx.db.delete(s._id);
    return { ok: true };
  },
});

/** Sesi aktif; boleh untuk akun yang wajib ganti password. */
export const getMe = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token, {
      allowStudent: true,
      allowPending: true,
    });
    return { user: sessionUser(user) };
  },
});

export const changePassword = mutation({
  args: {
    token: v.string(),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { token, oldPassword, newPassword }) => {
    const user = await requireAuth(ctx, token, {
      allowStudent: true,
      allowPending: true,
    });
    if (!oldPassword) fail("Password lama wajib diisi.");
    if (newPassword === oldPassword)
      fail("Password baru harus berbeda dari password lama.");
    assertStrongPassword(newPassword, [
      user.username,
      user.full_name,
      user.nip,
      user.phone,
    ]); // sama dengan daftar di login(), agar tidak dipaksa ganti lagi

    if (!(await verifyPassword(ctx, user, oldPassword)))
      fail("Password lama tidak sesuai.");

    await ctx.db.patch(user._id, {
      ...(await newHash(newPassword)),
      must_change_password: false,
      updated_at: nowIso(),
    });
    await revokeSessions(ctx, user.user_id); // semua sesi (termasuk ini) berakhir; login ulang
    return {
      message: "Password berhasil diubah.",
    };
  },
});
