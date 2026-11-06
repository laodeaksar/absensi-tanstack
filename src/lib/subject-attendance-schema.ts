import { z } from "zod";

import { makeFilterSchema } from "./attendance-schema";
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

export interface SubjectFilterRules {
  /** Pasangan yang boleh dipilih, dalam bentuk pairKey */
  pairs: string[];
  /** true untuk guru: tidak boleh tanggal masa depan dan dibatasi jendela edit */
  restricted: boolean;
  editWindowDays: number;
  tzOffsetMinutes?: number;
}

/** Filter absensi mapel: aturan tanggal sama dengan absensi harian, kelas diganti pasangan kelas + mapel. */
export function makeSubjectFilterSchema(rules: SubjectFilterRules) {
  return makeFilterSchema({
    classIds: [],
    restricted: rules.restricted,
    editWindowDays: rules.editWindowDays,
    tzOffsetMinutes: rules.tzOffsetMinutes,
  })
    .pick({ date: true })
    .extend({ pair: pairField(rules.pairs) });
}

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