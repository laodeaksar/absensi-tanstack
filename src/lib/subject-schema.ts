import { z } from "zod";

import { LIMITS } from "~/convex/limits";
import { RULES } from "~/convex/rules";

import type { Subject } from "./types";

export interface SubjectRules {
  /** Semua mata pelajaran yang ada (untuk cek duplikat) */
  subjects: Subject[];
  /** subject_id yang sedang diedit (dikecualikan dari cek duplikat) */
  editingId?: string;
}

/** Cerminan validasi backend (saveSubject): kode dan nama harus unik. */
export function makeSubjectSchema(rules: SubjectRules) {
  return z
    .object({
      code: z
        .string()
        .trim()
        .min(1, "Kode wajib diisi")
        .refine(
          (v) => !v || RULES.subjectCode.test(v),
          `Kode 2-${LIMITS.subjectCodeMax} karakter: huruf, angka, titik, minus, atau garis bawah`,
        ),
      name: z
        .string()
        .trim()
        .min(2, "Nama minimal 2 karakter")
        .max(LIMITS.subjectName, `Maksimal ${LIMITS.subjectName} karakter`),
      is_active: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const others = rules.subjects.filter(
        (s) => s.subject_id !== rules.editingId,
      );
      const code = v.code.trim().toUpperCase();
      const name = v.name.trim().toLowerCase();
      if (code && others.some((s) => s.code === code))
        ctx.addIssue({
          code: "custom",
          path: ["code"],
          message: "Kode sudah dipakai mata pelajaran lain",
        });
      if (name && others.some((s) => s.name.toLowerCase() === name))
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "Nama mata pelajaran sudah ada",
        });
    });
}