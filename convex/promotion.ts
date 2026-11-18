import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireAuth } from "./access";
import { assertMeetsKkm } from "./grades";
import { classById, nowIso, randomId, studentById } from "./lib";
import { syncStudentAccount } from "./master";
import { GRADUATION_LEVEL, gradeRank } from "./rules";
import { getSettingsMap } from "./settings";
import { fail } from "./errors";

/**
 * Kenaikan kelas dan kelulusan. Lapisan orkestrasi: boleh membaca `master` dan `grades`,
 * tidak boleh diimpor modul lain.
 *
 * Naik kelas (moveStudent), hanya bila kelas tujuan bertingkat lebih tinggi:
 *   1. tahun ajaran kelas asal sudah selesai (isYearFinished)
 *   2. nilai ganjil dan genap lengkap dan memenuhi KKM (assertMeetsKkm)
 * Tinggal kelas atau pindah setingkat tidak dicek.
 * Lulus (graduateStudent): tingkat XII, tahun ajaran selesai, KKM terpenuhi.
 *   Riwayat kelas ditutup dan akun siswa dinonaktifkan.
 */
export const moveStudent = mutation({
  args: {
    token: v.string(),
    studentId: v.string(),
    classId: v.string(),
  },
  handler: async (ctx, { token, studentId, classId }) => {
    await requireAuth(ctx, token, { admin: true });

    const student = await studentById(ctx, studentId);
    if (!student) fail("Data siswa tidak ditemukan.");
    if (!student!.is_active)
      fail("Siswa nonaktif. Aktifkan dulu sebelum memindahkan kelas.");

    const cls = await classById(ctx, classId);
    if (!cls || !cls.is_active) fail("Kelas tujuan tidak valid.");

    const hist = await ctx.db
      .query("student_class_history")
      .withIndex("by_student", (q) => q.eq("student_id", studentId))
      .collect();
    const active = hist.filter((h) => h.is_active);
    if (active.some((h) => h.class_id === classId))
      fail("Siswa sudah berada di kelas ini.");

    // Naik ke tingkat yang lebih tinggi wajib memenuhi KKM.
    // Pindah kelas setingkat (paralel atau tinggal kelas) tidak dicek.
    const activeYear = (await getSettingsMap(ctx)).active_academic_year;
    for (const h of active) {
      const from = await classById(ctx, h.class_id);
      if (!from || gradeRank(cls!.grade_level) <= gradeRank(from.grade_level))
        continue;
      if (activeYear && h.academic_year >= activeYear)
        fail(
          `Belum bisa naik kelas. Semester genap tahun ajaran ${h.academic_year} belum selesai.`,
        );
      await assertMeetsKkm(
        ctx,
        studentId,
        h.class_id,
        h.academic_year,
        "naik kelas",
      );
    }

    // Tutup riwayat aktif (bisa lebih dari satu bila data lama tidak rapi), lalu buka yang baru
    const now = nowIso();
    for (const h of active)
      await ctx.db.patch(h._id, {
        is_active: false,
        end_date: now,
      });
    await ctx.db.insert("student_class_history", {
      history_id: randomId("HST"),
      student_id: studentId,
      class_id: cls!.class_id,
      academic_year: cls!.academic_year,
      start_date: now,
      end_date: "",
      is_active: true,
      created_at: now,
    });
    return {
      message: `${student!.full_name} dipindahkan ke ${cls!.class_name}.`,
    };
  },
});

export const graduateStudent = mutation({
  args: { token: v.string(), studentId: v.string() },
  handler: async (ctx, { token, studentId }) => {
    await requireAuth(ctx, token, { admin: true });

    const student = await studentById(ctx, studentId);
    if (!student) fail("Data siswa tidak ditemukan.");
    if (!student!.is_active) fail("Siswa sudah nonaktif atau lulus.");

    const active = (
      await ctx.db
        .query("student_class_history")
        .withIndex("by_student", (q) => q.eq("student_id", studentId))
        .collect()
    ).filter((h) => h.is_active);

    if (!active.length) fail("Siswa belum memiliki kelas aktif.");
    for (const h of active) {
      const cls = await classById(ctx, h.class_id);
      if (cls?.grade_level !== GRADUATION_LEVEL)
        fail(`Kelulusan hanya untuk siswa tingkat ${GRADUATION_LEVEL}.`);
    }

    for (const h of active)
      await assertMeetsKkm(
        ctx,
        studentId,
        h.class_id,
        h.academic_year,
        "meluluskan siswa",
      );

    const now = nowIso();
    for (const h of active)
      await ctx.db.patch(h._id, { is_active: false, end_date: now });

    await ctx.db.patch(student!._id, {
      is_active: false,
      graduated_at: now,
      graduated_year: active[0]?.academic_year ?? "",
      updated_at: now,
    });
    // menonaktifkan akun login dan mencabut sesi
    await syncStudentAccount(ctx, studentId);

    return { message: `${student!.full_name} dinyatakan lulus.` };
  },
});