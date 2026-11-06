import { z } from "zod";

import type { TeachingRow } from "./types";

export interface TeachingRules {
  /** Semua baris pengampu yang ada (untuk cek pasangan kelas + mapel) */
  rows: TeachingRow[];
  /** teaching_id yang sedang diedit */
  editingId?: string;
  classIds: string[];
  subjectIds: string[];
  teacherIds: string[];
}

/** Cerminan validasi backend (saveTeaching): satu guru per mata pelajaran per kelas. */
export function makeTeachingSchema(rules: TeachingRules) {
  return z
    .object({
      class_id: z
        .string()
        .min(1, "Pilih kelas")
        .refine(
          (id) => !id || rules.classIds.includes(id),
          "Kelas tidak valid",
        ),
      subject_id: z
        .string()
        .min(1, "Pilih mata pelajaran")
        .refine(
          (id) => !id || rules.subjectIds.includes(id),
          "Mata pelajaran tidak valid",
        ),
      teacher_id: z
        .string()
        .min(1, "Pilih guru pengampu")
        .refine(
          (id) => !id || rules.teacherIds.includes(id),
          "Guru tidak valid",
        ),
    })
    .superRefine((v, ctx) => {
      if (!v.class_id || !v.subject_id) return;
      const dup = rules.rows.find(
        (r) =>
          r.teaching_id !== rules.editingId &&
          r.class_id === v.class_id &&
          r.subject_id === v.subject_id,
      );
      if (dup)
        ctx.addIssue({
          code: "custom",
          path: ["subject_id"],
          message: `Sudah diampu ${dup.teacher_name} di kelas ini`,
        });
    });
}
