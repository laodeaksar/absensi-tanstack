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

/** Batas gagal per username + alamat IP (atau per username saja bila IP klien tidak tersedia). */
const MAX_FAILS = 5;
/** Batas gagal per username dari semua alamat IP: perlindungan brute force terdistribusi. */
const MAX_FAILS_USER = 20;
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
  maxFails: number,
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
    locked_until: fails >= maxFails ? now + LOCK_MS : 0,
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
    // Diisi server aplikasi, bukan browser. Alamat IP hanya dipercaya bila serverSecret
    // cocok dengan LOGIN_SHARED_SECRET (env Convex); selain itu diabaikan.
    clientIp: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { username, password, clientIp, serverSecret }) => {
    const denied = (message: string, retryAfterMs = 0) => ({
      ok: false as const,
      message,
      retry_after_ms: retryAfterMs,
    });
    const key = username.trim().toLowerCase();
    const now = Date.now();
    // "|" dipakai sebagai pemisah kunci username|IP, jadi tidak boleh ada di username
    if (!key || key.length > 100 || key.includes("|") || password.length > 200)
      return denied("Username atau password salah.");

    // Hitungan gagal per username+IP: penyerang dari satu IP tidak bisa mengunci akun
    // dari IP lain. Tanpa IP tepercaya, dipakai hitungan per username seperti sebelumnya.
    const secret = process.env.LOGIN_SHARED_SECRET;
    const ip =
      clientIp && secret && serverSecret && safeEqual(serverSecret, secret)
        ? clientIp.trim().slice(0, 64)
        : "";
    const ipKey = ip ? `${key}|${ip}` : "";

    const attemptOf = (k: string) =>
      ctx.db
        .query("login_attempts")
        .withIndex("by_key", (q) => q.eq("key", k))
        .unique();
    const attempt = await attemptOf(key);
    const ipAttempt = ipKey ? await attemptOf(ipKey) : null;

    const lockedNow = Math.max(
      attempt?.locked_until ?? 0,
      ipAttempt?.locked_until ?? 0,
    );
    if (lockedNow > now)
      return denied("Terlalu banyak percobaan gagal.", lockedNow - now);

    const user = await ctx.db
      .query("users")
      .withIndex("by_username_lc", (q) => q.eq("username_lc", key))
      .unique();
    let valid = false;
    if (user && user.is_active)
      valid = await verifyPassword(ctx, user, password);
    // Samakan waktu respons: jalur tanpa PBKDF2 (username tidak ada/nonaktif, hash "nisn" atau
    // "sha256") tetap menjalankan satu PBKDF2 agar jenis akun tidak bisa ditebak dari kecepatan.
    if (
      !user ||
      !user.is_active ||
      user.hash_algo === "nisn" ||
      user.hash_algo === "sha256"
    )
      await pbkdf2Hex(password, "waktu-respons-palsu", PBKDF2_ITERATIONS);
    if (!valid || !user) {
      const lockedIp = ipKey
        ? await recordFailure(ctx, ipKey, now, MAX_FAILS)
        : 0;
      const lockedUser = await recordFailure(
        ctx,
        key,
        now,
        ipKey ? MAX_FAILS_USER : MAX_FAILS,
      );
      const lockedUntil = Math.max(lockedIp, lockedUser);
      return lockedUntil > now
        ? denied("Terlalu banyak percobaan gagal.", lockedUntil - now)
        : denied("Username atau password salah.");
    }

    if (attempt) await ctx.db.delete(attempt._id);
    if (ipAttempt) await ctx.db.delete(ipAttempt._id);

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
