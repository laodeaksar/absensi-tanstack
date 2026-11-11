import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";

import { mutation, query, internalMutation } from "./_generated/server";
import { fail, nowIso, requireAuth, tzOffsetMinutes } from "./lib";
import { LIMITS } from "./limits";
import { RULES, isAcademicYear, isMonthDay, periodFor } from "./rules";

export const SETTINGS_DEFAULTS: Record<string, string> = {
  school_name: "EduAbsen",
  school_address: "",
  principal_name: "",
  principal_nip: "",
  active_academic_year: "",
  active_semester: "", // "ganjil" | "genap"
  auto_semester: "0", // "1" = tahun ajaran dan semester mengikuti kalender
  semester_ganjil_start: "07-15",
  semester_genap_start: "01-12",
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

/** Samakan tahun ajaran dan semester aktif dengan kalender bila mode otomatis menyala. */
export async function syncSemester(ctx: MutationCtx) {
  const s = await getSettingsMap(ctx);
  if (s.auto_semester !== "1") return;
  if (
    !isMonthDay(s.semester_ganjil_start) ||
    !isMonthDay(s.semester_genap_start)
  )
    return;
  // "hari ini" menurut zona waktu sekolah (env TZ_OFFSET_MINUTES), sama dengan yang dipakai klien
  const today = new Date(Date.now() + tzOffsetMinutes() * 60_000)
    .toISOString()
    .slice(0, 10);
  const p = periodFor(today, s.semester_ganjil_start, s.semester_genap_start);
  if (
    s.active_academic_year !== p.academicYear ||
    s.active_semester !== p.semester
  )
    await upsertSettings(ctx, {
      active_academic_year: p.academicYear,
      active_semester: p.semester,
    });
}

export const advanceSemester = internalMutation({
  args: {},
  handler: async (ctx) => {
    await syncSemester(ctx);
    return null;
  },
});

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
  if (d.auto_semester !== undefined) {
    const s = str("auto_semester") || "0";
    if (s !== "0" && s !== "1") fail("Mode otomatis semester tidak valid.");
    out.auto_semester = s;
  }
  if (d.active_semester !== undefined) {
    const s = str("active_semester");
    if (s !== "" && s !== "ganjil" && s !== "genap")
      fail("Semester harus ganjil atau genap.");
    out.active_semester = s;
  }
  for (const k of ["semester_ganjil_start", "semester_genap_start"] as const) {
    if (d[k] !== undefined) {
      const s = str(k);
      if (!isMonthDay(s))
        fail("Awal semester harus berformat BB-HH, mis. 07-15.");
      out[k] = s;
    }
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
            active_semester: all.active_semester,
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
  active_semester: v.optional(v.string()),
  auto_semester: v.optional(v.string()),
  semester_ganjil_start: v.optional(v.string()),
  semester_genap_start: v.optional(v.string()),
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
    if (next.semester_genap_start >= next.semester_ganjil_start)
      fail(
        "Awal semester genap harus lebih awal dari semester ganjil dalam satu tahun kalender (mis. 01-12 dan 07-15).",
      );
    await upsertSettings(ctx, clean);
    await syncSemester(ctx); // mode otomatis: langsung berlaku tanpa menunggu cron
    await upsertSettings(ctx, clean);
    return {
      message: "Pengaturan berhasil disimpan.",
      settings: await getSettingsMap(ctx),
    };
  },
});
