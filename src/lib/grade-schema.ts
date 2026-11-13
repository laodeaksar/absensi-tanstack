import { z } from "zod";

import { LIMITS } from "~/convex/limits";
import { isAcademicYear } from "~/convex/rules";

const num = (v: string) => Number(v.trim().replace(",", "."));
const isNum = (v: string) => v.trim() !== "" && Number.isFinite(num(v));

export const gradePeriodSchema = z.object({
  year: z.string().refine(isAcademicYear, "Format 2025/2026"),
  semester: z
    .string()
    .refine((v) => v === "ganjil" || v === "genap", "Pilih semester"),
});

export const gradeFilterSchema = gradePeriodSchema.extend({
  classId: z.string().min(1, "Pilih kelas"),
  subjectId: z.string().min(1, "Pilih mata pelajaran"),
});

export const parseScore = (v: string) => (v.trim() === "" ? null : num(v));
/** null = dikosongkan (hapus nilai), undefined = tidak valid. */
/* export function parseScore(raw: string): number | null | undefined {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
} */

const scoreText = z
  .string()
  .refine(
    (v) => v.trim() === "" || (isNum(v) && num(v) >= 0 && num(v) <= 100),
    "0 - 100",
  );

export const gradeScoresSchema = z.object({
  scores: z.record(z.string(), z.record(z.string(), scoreText)),
});

export const gradeConfigSchema = z
  .object({
    kkm: z
      .string()
      .refine((v) => isNum(v) && num(v) >= 0 && num(v) <= 100, "KKM 0 - 100"),
    components: z
      .array(
        z.object({
          key: z.string(),
          label: z
            .string()
            .trim()
            .min(1, "Nama wajib diisi")
            .max(30, "Maksimal 30 karakter"),
          weight: z
            .string()
            .refine(
              (v) => isNum(v) && num(v) > 0 && num(v) <= 100,
              "Bobot 1 - 100",
            ),
          source: z.string(),
        }),
      )
      .min(1, "Minimal satu komponen")
      .max(LIMITS.maxComponents, `Maksimal ${LIMITS.maxComponents} komponen`),
  })
  .superRefine((v, ctx) => {
    const total = v.components.reduce(
      (s, c) => s + (isNum(c.weight) ? num(c.weight) : 0),
      0,
    );
    if (Math.abs(total - 100) > 0.001)
      ctx.addIssue({
        code: "custom",
        path: ["components"],
        message: `Total bobot harus 100% (sekarang ${total}%)`,
      });
    if (v.components.filter((c) => c.source === "tugas").length > 1)
      ctx.addIssue({
        code: "custom",
        path: ["components"],
        message: "Komponen tugas otomatis hanya boleh satu",
      });
  });

export { num as parseNum };
