import { z } from "zod";

import { LIMITS, needsNotes } from "~/convex/limits";
import { STATUS_VALUES } from "~/convex/rules";

import { isRealDate, shiftDays, todayStr } from "./date";

/* ---------- filter (tanggal + kelas): aturan bergantung peran, kelas, dan pengaturan ---------- */

export interface FilterRules {
  /** Daftar kelas yang boleh dipilih pengguna ini */
  classIds: string[];
  /** true untuk guru: tidak boleh tanggal masa depan dan dibatasi jendela edit */
  restricted: boolean;
  /** edit_window_days dari pengaturan; 0 = tanpa batas */
  editWindowDays: number;
  /** Selisih zona waktu sekolah dari UTC (menit), sama dengan TZ_OFFSET_MINUTES di server. */
  tzOffsetMinutes?: number;
}

export const earliestDate = (
  r: Pick<FilterRules, "restricted" | "editWindowDays" | "tzOffsetMinutes">,
) =>
  r.restricted && r.editWindowDays > 0
    ? shiftDays(todayStr(r.tzOffsetMinutes), -r.editWindowDays)
    : undefined;

export function makeFilterSchema(rules: FilterRules) {
  return z.object({
    date: z
      .string()
      .min(1, "Tanggal wajib diisi")
      .refine((d) => !d || isRealDate(d), "Tanggal tidak valid")
      .refine(
        (d) =>
          !rules.restricted ||
          !isRealDate(d) ||
          d <= todayStr(rules.tzOffsetMinutes),
        "Tidak dapat mengisi absensi untuk tanggal yang akan datang",
      )
      .refine((d) => {
        const e = earliestDate(rules);
        return !e || !isRealDate(d) || d >= e;
      }, `Guru hanya dapat mengisi atau mengubah absensi maksimal ${rules.editWindowDays} hari ke belakang`),
    classId: z
      .string()
      .min(1, "Pilih kelas")
      .refine(
        (id) => !id || rules.classIds.includes(id),
        "Kelas tidak tersedia untuk akun Anda",
      ),
  });
}

/* ---------- grid absensi: aturan per baris bergantung status ---------- */

export const rowSchema = z
  .object({
    student_id: z.string(),
    nis: z.string(),
    full_name: z.string(),
    // '' = belum diisi (tidak disimpan)
    status: z
      .string()
      .refine(
        (v) => v === "" || (STATUS_VALUES as readonly string[]).includes(v),
        "Status tidak valid",
      ),
    notes: z
      .string()
      .max(LIMITS.notesMax, `Maksimal ${LIMITS.notesMax} karakter`),
  })
  .superRefine((row, ctx) => {
    if (needsNotes(row.status) && row.notes.trim().length < LIMITS.notesMin) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: `Keterangan wajib untuk status ${row.status} (min. ${LIMITS.notesMin} karakter)`,
      });
    }
  });

export const gridSchema = z.object({
  rows: z.array(rowSchema),
});

/** Ambil pesan pertama dari daftar error TanStack Form (string atau issue standard schema). */
export function firstMessage(errors: unknown[]): string {
  const e = errors.find(Boolean);
  if (!e) return "";
  return typeof e === "string"
    ? e
    : ((e as { message?: string }).message ?? "");
}
