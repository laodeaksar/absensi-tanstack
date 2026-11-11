import { z } from "zod";

import { LIMITS, needsNotes } from "~/convex/limits";
import { STATUS_VALUES } from "~/convex/rules";

import { isRealDate, shiftDays, todayStr } from "./date";

// Dipakai halaman absensi harian dan absensi mata pelajaran
export { STATUS_VALUES, needsNotes };
/** Panjang minimal keterangan untuk status Sakit/Izin */
export const NOTES_MIN = LIMITS.notesMin;

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
/* export function firstMessage(errors: unknown[]): string {
  const e = errors.find(Boolean);
  if (!e) return "";
  return typeof e === "string"
    ? e
    : ((e as { message?: string }).message ?? "");
} */

/* ---------- pilihan jenis absensi (harian atau mata pelajaran) ---------- */

/** Nilai pilihan mata pelajaran di form untuk absensi harian (tanpa mata pelajaran). */
export const DAILY_SUBJECT = "harian";

/** Nilai untuk input mata pelajaran di form: id mapel, atau DAILY_SUBJECT bila harian. */
export const subjectValue = (subjectId?: string) => subjectId || DAILY_SUBJECT;

/** "classId" = absensi harian; "classId|subjectId" = absensi mata pelajaran. */
export const targetKey = (classId: string, subjectId?: string) =>
  subjectId ? `${classId}|${subjectId}` : classId;

export interface Target {
  classId: string;
  /** undefined = absensi harian. Kuncinya selalu ada, sesuai bentuk search route. */
  subjectId: string | undefined;
}

/**
 * Menjadi Target dari dua bentuk:
 *  - kunci `targetKey` ("classId" atau "classId|subjectId"), atau
 *  - nilai form terpisah `{ classId, subjectId }`, di mana subjectId boleh DAILY_SUBJECT
 *    atau kosong untuk absensi harian.
 */
export function parseTarget(
  input: string | { classId: string; subjectId?: string },
): Target {
  if (typeof input === "string") {
    const [classId = "", subjectId = ""] = input.split("|");
    return {
      classId,
      subjectId:
        subjectId && subjectId !== DAILY_SUBJECT ? subjectId : undefined,
    };
  }
  const { classId, subjectId } = input;
  return {
    classId,
    subjectId: subjectId && subjectId !== DAILY_SUBJECT ? subjectId : undefined,
  };
}

export interface TargetFilterRules {
  /** Pilihan yang boleh dipakai akun ini, dalam bentuk targetKey */
  targets: string[];
  restricted: boolean;
  editWindowDays: number;
  tzOffsetMinutes?: number;
}

/** Filter halaman absensi: aturan tanggal sama untuk harian dan mapel, kelas/mapel dipilih lewat satu nilai. */
export function makeTargetFilterSchema(rules: TargetFilterRules) {
  return makeFilterSchema({
    classIds: [],
    restricted: rules.restricted,
    editWindowDays: rules.editWindowDays,
    tzOffsetMinutes: rules.tzOffsetMinutes,
  })
    .pick({ date: true })
    .extend({
      target: z
        .string()
        .min(1, "Pilih kelas atau mata pelajaran")
        .refine(
          (k) => !k || rules.targets.includes(k),
          "Pilihan tidak tersedia untuk akun Anda",
        ),
    });
}

/**
 * Filter halaman absensi dengan kelas dan mata pelajaran sebagai dua input terpisah.
 * `subjectId` berisi id mata pelajaran, atau DAILY_SUBJECT untuk absensi harian.
 * Pasangan yang boleh dipakai tetap ditentukan `rules.targets` (bentuk targetKey).
 */
export function makeSplitFilterSchema(rules: TargetFilterRules) {
  return makeFilterSchema({
    classIds: [],
    restricted: rules.restricted,
    editWindowDays: rules.editWindowDays,
    tzOffsetMinutes: rules.tzOffsetMinutes,
  })
    .pick({ date: true })
    .extend({
      classId: z.string().min(1, "Pilih kelas"),
      subjectId: z.string().min(1, "Pilih mata pelajaran atau absensi harian"),
    })
    .superRefine((v, ctx) => {
      if (!v.classId || !v.subjectId) return;
      const t = parseTarget(v);
      if (!rules.targets.includes(targetKey(t.classId, t.subjectId)))
        ctx.addIssue({
          code: "custom",
          path: ["subjectId"],
          message: "Pilihan tidak tersedia untuk akun Anda",
        });
    });
}
