import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { assertStrongPassword, fail, newHash, nowIso, randomId } from "./lib";

/**
 * Buat akun admin pertama (jalankan sekali dari terminal):
 *   npx convex run seed:createAdmin '{"password":"KataSandiKuat!2025"}'
 * Password harus memenuhi kebijakan password kuat.
 */
export const createAdmin = internalMutation({
  args: { password: v.string(), username: v.optional(v.string()), fullName: v.optional(v.string()) },
  handler: async (ctx, { password, username, fullName }) => {
    const uname = (username ?? "admin").trim();
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(uname)) fail("Username 3-30 karakter: huruf, angka, titik, garis bawah, atau strip.");
    const taken = await ctx.db.query("users").withIndex("by_username_lc", (q) => q.eq("username_lc", uname.toLowerCase())).unique();
    if (taken) fail("Username sudah digunakan.");
    assertStrongPassword(password, [uname, fullName]);

    const now = nowIso();
    await ctx.db.insert("users", {
      user_id: randomId("USR"), username: uname, username_lc: uname.toLowerCase(), ...(await newHash(password)),
      full_name: fullName ?? "Administrator Utama", role: "admin", assigned_classes: [], is_active: true,
      nip: "", phone: "", email: "", student_id: "", must_change_password: false, created_at: now, updated_at: now,
    });
    return { ok: true, username: uname };
  },
});