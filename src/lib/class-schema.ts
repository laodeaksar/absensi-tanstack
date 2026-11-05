import { z } from "zod";

import { LIMITS } from "~/convex/limits";
import { isAcademicYear } from "~/convex/rules";

import type { ClassRow } from "./types";

import { isActive } from "./types";

export interface ClassRules {
  /** Semua kelas yang ada (untuk cek duplikat) */
  classes: ClassRow[];
  /** class_id yang sedang diedit (dikecualikan dari cek duplikat) */
  editingId?: string;
  /** Wali kelas yang boleh dipilih: guru aktif + wali kelas saat ini bila sedang edit */
  teacherIds: string[];
  /** Nama guru per user_id (untuk pesan error) */
  teacherNames: Record<string, string>;
  /** Nilai wali/tahun ajaran kelas yang sedang diedit sebelum diubah */
  original?: {
    homeroom_teacher: string;
    academic_year: string;
    is_active: boolean;
  };
}

/**
 * Cerminan validasi backend (saveClass), dibuat dari data terbaru:
 * - nama kelas unik per tahun ajaran
 * - wali kelas harus guru yang valid
 * - satu guru hanya boleh menjadi wali satu kelas aktif per tahun ajaran
 *   (hanya diperiksa saat wali atau tahun ajaran diubah, agar data lama tidak menghalangi edit lain)
 */
export function makeClassSchema(rules: ClassRules) {
  return z
    .object({
      class_name: z
        .string()
        .trim()
        .min(1, "Nama kelas wajib diisi")
        .max(LIMITS.className, `Maksimal ${LIMITS.className} karakter`),
      grade_level: z
        .string()
        .trim()
        .min(1, "Tingkat wajib diisi")
        .max(LIMITS.gradeLevel, `Maksimal ${LIMITS.gradeLevel} karakter`),
      academic_year: z
        .string()
        .trim()
        .min(1, "Tahun ajaran wajib diisi")
        .refine(
          (v) => !v || isAcademicYear(v),
          "Format harus 2025/2026 (tahun berurutan)",
        ),
      homeroom_teacher: z
        .string()
        .refine(
          (id) => !id || rules.teacherIds.includes(id),
          "Wali kelas tidak valid",
        ),
      is_active: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const name = v.class_name.trim();
      const year = v.academic_year.trim();
      if (!name || !year) return;
      const dup = rules.classes.some(
        (c) =>
          c.class_id !== rules.editingId &&
          c.class_name === name &&
          c.academic_year === year,
      );
      if (dup) {
        ctx.addIssue({
          code: "custom",
          path: ["class_name"],
          message: `Kelas "${name}" sudah ada pada tahun ajaran ${year}`,
        });
      }

      const teacher = v.homeroom_teacher;
      // Kelas nonaktif tidak diperiksa; mengaktifkan kembali kelas nonaktif diperiksa penuh
      const reactivating = rules.original?.is_active === false && v.is_active;
      if (
        v.is_active &&
        teacher &&
        (teacher !== rules.original?.homeroom_teacher ||
          year !== rules.original?.academic_year ||
          reactivating)
      ) {
        const other = rules.classes.find(
          (c) =>
            isActive(c.is_active) &&
            c.class_id !== rules.editingId &&
            c.homeroom_teacher === teacher &&
            c.academic_year === year,
        );
        if (other) {
          ctx.addIssue({
            code: "custom",
            path: ["homeroom_teacher"],
            message: `${rules.teacherNames[teacher] ?? "Guru ini"} sudah menjadi wali kelas ${other.class_name} pada tahun ajaran ${year}`,
          });
        }
      }
    });
}
