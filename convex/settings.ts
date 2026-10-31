import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, nowIso, requireAuth } from "./lib";

export const SETTINGS_DEFAULTS: Record<string, string> = {
  school_name: "EduAbsen",
  school_address: "",
  principal_name: "",
  principal_nip: "",
  active_academic_year: "",
  edit_window_days: "0", // 0 = guru boleh mengubah absensi tanggal berapa pun
};

export async function getSettingsMap(ctx: QueryCtx): Promise<Record<string, string>> {
  const map = { ...SETTINGS_DEFAULTS };
  const rows = await ctx.db.query("settings").collect();
  for (const r of rows) {
    if (Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, r.setting_key)) map[r.setting_key] = r.setting_value;
  }
  if (!map.school_name) map.school_name = SETTINGS_DEFAULTS.school_name;
  return map;
}

async function upsertSettings(ctx: MutationCtx, values: Record<string, string>) {
  const now = nowIso();
  for (const [key, value] of Object.entries(values)) {
    const row = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("setting_key", key)).unique();
    if (row) await ctx.db.patch(row._id, { setting_value: value, updated_at: now });
    else await ctx.db.insert("settings", { setting_key: key, setting_value: value, updated_at: now });
  }
}

function validateSettings(d: Record<string, unknown>) {
  const out: Record<string, string> = {};
  const str = (k: string) => String(d[k] ?? "").trim();

  if (d.school_name !== undefined) {
    const s = str("school_name");
    if (!s) fail("Nama sekolah wajib diisi.");
    if (s.length > 100) fail("Nama sekolah maksimal 100 karakter.");
    out.school_name = s;
  }
  if (d.school_address !== undefined) {
    const s = str("school_address");
    if (s.length > 200) fail("Alamat sekolah maksimal 200 karakter.");
    out.school_address = s;
  }
  if (d.principal_name !== undefined) {
    const s = str("principal_name");
    if (s.length > 100) fail("Nama kepala sekolah maksimal 100 karakter.");
    out.principal_name = s;
  }
  if (d.principal_nip !== undefined) {
    const s = str("principal_nip");
    if (s && !/^[0-9]{5,30}$/.test(s)) fail("NIP kepala sekolah hanya berisi angka (5-30 digit).");
    out.principal_nip = s;
  }
  if (d.active_academic_year !== undefined) {
    const s = str("active_academic_year");
    if (s) {
      const m = /^(\d{4})\/(\d{4})$/.exec(s);
      if (!m || Number(m[2]) !== Number(m[1]) + 1) fail("Tahun ajaran harus berformat 2025/2026.");
    }
    out.active_academic_year = s;
  }
  if (d.edit_window_days !== undefined) {
    const s = str("edit_window_days") || "0";
    if (!/^[0-9]{1,3}$/.test(s) || Number(s) > 365) fail("Batas edit absensi harus 0-365 hari.");
    out.edit_window_days = String(Number(s));
  }
  return out;
}

/** Tanpa login: hanya data aman untuk halaman login. */
export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => ({ settings: { school_name: (await getSettingsMap(ctx)).school_name } }),
});

export const getSettings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token, { allowStudent: true, allowPending: true });
    return { settings: await getSettingsMap(ctx) };
  },
});

export const saveSettings = mutation({
  args: { token: v.string(), data: v.any() },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    if (!data || typeof data !== "object") fail("Data pengaturan tidak boleh kosong.");
    await upsertSettings(ctx, validateSettings(data as Record<string, unknown>));
    return { message: "Pengaturan berhasil disimpan.", settings: await getSettingsMap(ctx) };
  },
});