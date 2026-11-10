import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import { fail, nowIso, requireAuth, tzOffsetMinutes } from "./lib";
import { LIMITS } from "./limits";
import { RULES, isAcademicYear } from "./rules";

export const SETTINGS_DEFAULTS: Record<string, string> = {
  school_name: "EduAbsen",
  school_address: "",
  principal_name: "",
  principal_nip: "",
  active_academic_year: "",
  edit_window_days: "0", // 0 = guru boleh mengubah absensi tanggal berapa pun
};

export async function getSettingsMap(
  ctx: QueryCtx,
): Promise<Record<string, string>> {
  const map = { ...SETTINGS_DEFAULTS };
  const rows = await ctx.db.query("settings").collect();
  for (const r of rows) {
    if (Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, r.setting_key))
      map[r.setting_key] = r.setting_value;
  }
  if (!map.school_name) map.school_name = SETTINGS_DEFAULTS.school_name;
  // Turunan dari env TZ_OFFSET_MINUTES (tidak disimpan): klien memakainya agar "hari ini" sama dengan server.
  map.tz_offset_minutes = String(tzOffsetMinutes());
  return map;
}

async function upsertSettings(
  ctx: MutationCtx,
  values: Record<string, string>,
) {
  const now = nowIso();
  for (const [key, value] of Object.entries(values)) {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("setting_key", key))
      .unique();
    if (row)
      await ctx.db.patch(row._id, {
        setting_value: value,
        updated_at: now,
      });
    else
      await ctx.db.insert("settings", {
        setting_key: key,
        setting_value: value,
        updated_at: now,
      });
  }
}

function validateSettings(d: Record<string, unknown>) {
  const out: Record<string, string> = {};
  const str = (k: string) => String(d[k] ?? "").trim();

  if (d.school_name !== undefined) {
    const s = str("school_name");
    if (!s) fail("Nama sekolah wajib diisi.");
    if (s.length > LIMITS.schoolName)
      fail(`Nama sekolah maksimal ${LIMITS.schoolName} karakter.`);
    out.school_name = s;
  }
  if (d.school_address !== undefined) {
    const s = str("school_address");
    if (s.length > LIMITS.schoolAddress)
      fail(`Alamat sekolah maksimal ${LIMITS.schoolAddress} karakter.`);
    out.school_address = s;
  }
  if (d.principal_name !== undefined) {
    const s = str("principal_name");
    if (s.length > LIMITS.personName)
      fail(`Nama kepala sekolah maksimal ${LIMITS.personName} karakter.`);
    out.principal_name = s;
  }
  if (d.principal_nip !== undefined) {
    const s = str("principal_nip");
    if (s && !RULES.nip.test(s))
      fail("NIP kepala sekolah hanya berisi angka (5-30 digit).");
    out.principal_nip = s;
  }
  if (d.active_academic_year !== undefined) {
    const s = str("active_academic_year");
    if (s && !isAcademicYear(s))
      fail("Tahun ajaran harus berformat 2025/2026.");
    out.active_academic_year = s;
  }
  if (d.edit_window_days !== undefined) {
    const s = str("edit_window_days") || "0";
    if (!/^[0-9]{1,3}$/.test(s) || Number(s) > LIMITS.editWindowMaxDays)
      fail(`Batas edit absensi harus 0-${LIMITS.editWindowMaxDays} hari.`);
    out.edit_window_days = String(Number(s));
  }
  return out;
}

/** Tanpa login: hanya data aman untuk halaman login. */
export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => ({
    settings: {
      school_name: (await getSettingsMap(ctx)).school_name,
    },
  }),
});

export const getSettings = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await requireAuth(ctx, token, {
      allowStudent: true,
      allowPending: true,
    });
    const all = await getSettingsMap(ctx);
    // Siswa tidak perlu NIP/nama kepala sekolah dan alamat; kirim yang dibutuhkan saja
    const settings =
      user.role === "siswa"
        ? {
            school_name: all.school_name,
            active_academic_year: all.active_academic_year,
            tz_offset_minutes: all.tz_offset_minutes,
          }
        : all;
    return { settings };
  },
});

// Semua field opsional: hanya yang dikirim yang diperbarui. Field tak dikenal ditolak.
const settingsInput = v.object({
  school_name: v.optional(v.string()),
  school_address: v.optional(v.string()),
  principal_name: v.optional(v.string()),
  principal_nip: v.optional(v.string()),
  active_academic_year: v.optional(v.string()),
  edit_window_days: v.optional(v.string()),
});

export const saveSettings = mutation({
  args: { token: v.string(), data: settingsInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, {
      admin: true,
    });
    const clean = validateSettings(data);
    // Aturan lintas field (cerminan schoolSchema di klien): diperiksa terhadap hasil gabungan,
    // karena pembaruan boleh sebagian.
    const next = { ...(await getSettingsMap(ctx)), ...clean };
    if (next.principal_nip && !next.principal_name)
      fail("Nama kepala sekolah wajib diisi jika NIP diisi.");
    await upsertSettings(ctx, clean);
    return {
      message: "Pengaturan berhasil disimpan.",
      settings: await getSettingsMap(ctx),
    };
  },
});
