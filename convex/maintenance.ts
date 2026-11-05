import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { LIMITS } from "./limits";

const BATCH = 500;

/** Bersihkan sesi kedaluwarsa dan catatan gagal-login lama (dijalankan berkala oleh crons.ts). */
export const cleanup = internalMutation({
  args: {},
  // Tipe kembalian ditulis eksplisit: fungsi ini memanggil dirinya sendiri lewat `internal`
  handler: async (ctx): Promise<{ sessions: number; attempts: number }> => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_expiry", (q) => q.lt("expires_at", now))
      .take(BATCH);
    for (const s of sessions) await ctx.db.delete(s._id);

    const attempts = await ctx.db
      .query("login_attempts")
      .withIndex("by_last_fail", (q) =>
        q.lt("last_fail", now - LIMITS.loginLockMs),
      )
      .take(BATCH);
    for (const a of attempts) await ctx.db.delete(a._id);

    // Batch penuh berarti mungkin masih ada sisa: lanjutkan segera, jangan tunggu 6 jam
    if (sessions.length === BATCH || attempts.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.maintenance.cleanup);
    }
    return { sessions: sessions.length, attempts: attempts.length };
  },
});
