import { z } from "zod";

import { isRealDate } from "./date";
import { rangeIssue } from "./validation";

/** Pasangan kelas + mapel disimpan sebagai satu nilai pilihan: "classId|subjectId". */
export const pairKey = (classId: string, subjectId: string) =>
  `${classId}|${subjectId}`;

export function parsePair(key: string): { classId: string; subjectId: string } {
  const [classId = "", subjectId = ""] = key.split("|");
  return { classId, subjectId };
}

const pairField = (pairs: string[]) =>
  z
    .string()
    .min(1, "Pilih kelas dan mata pelajaran")
    .refine(
      (k) => !k || pairs.includes(k),
      "Kelas dan mata pelajaran tidak tersedia untuk akun Anda",
    );

/** Filter rekap mapel: pasangan kelas + mapel wajib, rentang tanggal wajib dan dibatasi. */
export function makeSubjectReportFilterSchema(rules: { pairs: string[] }) {
  const requiredDate = (label: string) =>
    z
      .string()
      .min(1, `${label} wajib diisi`)
      .refine((v) => !v || isRealDate(v), `${label} tidak valid`);
  return z
    .object({
      pair: pairField(rules.pairs),
      startDate: requiredDate("Tanggal awal"),
      endDate: requiredDate("Tanggal akhir"),
    })
    .superRefine((v, ctx) => {
      const msg = rangeIssue(v.startDate, v.endDate);
      if (msg)
        ctx.addIssue({ code: "custom", path: ["endDate"], message: msg });
    });
}

/**
 * Filter rekap mapel dengan kelas dan mata pelajaran sebagai dua input terpisah.
 * Pasangan yang boleh dipakai tetap ditentukan `rules.pairs` (bentuk pairKey).
 */
export function makeSplitSubjectReportFilterSchema(rules: { pairs: string[] }) {
  const requiredDate = (label: string) =>
    z
      .string()
      .min(1, `${label} wajib diisi`)
      .refine((v) => !v || isRealDate(v), `${label} tidak valid`);
  return z
    .object({
      classId: z.string().min(1, "Pilih kelas"),
      subjectId: z.string().min(1, "Pilih mata pelajaran"),
      startDate: requiredDate("Tanggal awal"),
      endDate: requiredDate("Tanggal akhir"),
    })
    .superRefine((v, ctx) => {
      if (
        v.classId &&
        v.subjectId &&
        !rules.pairs.includes(pairKey(v.classId, v.subjectId))
      )
        ctx.addIssue({
          code: "custom",
          path: ["subjectId"],
          message: "Kelas dan mata pelajaran tidak tersedia untuk akun Anda",
        });
      const msg = rangeIssue(v.startDate, v.endDate);
      if (msg)
        ctx.addIssue({ code: "custom", path: ["endDate"], message: msg });
    });
}
