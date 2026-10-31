import { internalMutation } from "./_generated/server";

const WINDOW_MS = 15 * 60_000;

/** Bersihkan sesi kedaluwarsa dan catatan gagal-login lama (dijalankan berkala oleh crons.ts). */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db.query("sessions").withIndex("by_expiry", (q) => q.lt("expires_at", now)).take(500);
    for (const s of sessions) await ctx.db.delete(s._id);

    const attempts = await ctx.db.query("login_attempts").withIndex("by_last_fail", (q) => q.lt("last_fail", now - WINDOW_MS)).take(500);
    for (const a of attempts) await ctx.db.delete(a._id);

    return { sessions: sessions.length, attempts: attempts.length };
  },
});