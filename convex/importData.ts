import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { fail } from "./lib";

/**
 * Impor data hasil ekspor Google Sheets (lihat apps-script/Export.gs dan scripts/import-from-sheets.mjs).
 * Dilindungi env IMPORT_SECRET di dashboard Convex. HAPUS file ini dan env-nya setelah migrasi selesai.
 */

const S = (x: unknown) => (x === undefined || x === null ? "" : String(x));
const B = (x: unknown) => x === true || x === "TRUE" || x === "true";
const N = (x: unknown, d = 0) => (x === "" || x === null || x === undefined || !Number.isFinite(Number(x)) ? d : Number(x));
const NN = (x: unknown) => (x === "" || x === null || x === undefined || !Number.isFinite(Number(x)) ? null : Number(x));
const J = (x: unknown): string[] => {
  try {
    const a = typeof x === "string" ? JSON.parse(x || "[]") : x;
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
};
type Row = Record<string, unknown>;

async function importOne(ctx: MutationCtx, table: string, r: Row): Promise<boolean> {
  switch (table) {
    case "Users": {
      const id = S(r.user_id);
      if (!id || (await ctx.db.query("users").withIndex("by_user_id", (q) => q.eq("user_id", id)).unique())) return false;
      const role = S(r.role) as "admin" | "guru" | "siswa";
      if (!["admin", "guru", "siswa"].includes(role)) return false;
      const mustChange = B(r.must_change_password);
      // Akun siswa yang belum ganti password: password awal = NISN -> dicocokkan ke data siswa
      const nisnMode = role === "siswa" && mustChange;
      await ctx.db.insert("users", {
        user_id: id, 
        username: S(r.username), 
        username_lc: S(r.username).toLowerCase(),
        hash_algo: nisnMode ? "nisn" : "sha256", 
        password_hash: nisnMode ? "" : S(r.password_hash),
        password_salt: nisnMode ? "" : S(r.password_salt), 
        full_name: S(r.full_name), 
        role,
        assigned_classes: J(r.assigned_classes), 
        is_active: B(r.is_active),
        nip: S(r.nip), 
        phone: S(r.phone), 
        email: S(r.email),
        student_id: S(r.student_id),
        must_change_password: mustChange,
        created_at: S(r.created_at),
        updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Classes": {
      const id = S(r.class_id);
      if (!id || (await ctx.db.query("classes").withIndex("by_class_id", (q) => q.eq("class_id", id)).unique())) return false;
      await ctx.db.insert("classes", {
        class_id: id, class_name: S(r.class_name), grade_level: S(r.grade_level), academic_year: S(r.academic_year),
        homeroom_teacher: S(r.homeroom_teacher), description: S(r.description), is_active: B(r.is_active),
        created_at: S(r.created_at), updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Students": {
      const id = S(r.student_id);
      if (!id || (await ctx.db.query("students").withIndex("by_student_id", (q) => q.eq("student_id", id)).unique())) return false;
      await ctx.db.insert("students", {
        student_id: id, nis: S(r.nis), nisn: S(r.nisn), full_name: S(r.full_name), gender: S(r.gender),
        birth_place: S(r.birth_place), birth_date: S(r.birth_date), address: S(r.address), parent_name: S(r.parent_name),
        parent_phone: S(r.parent_phone), is_active: B(r.is_active), created_at: S(r.created_at), updated_at: S(r.updated_at),
      });
      return true;
    }
    case "StudentClassHistory": {
      const id = S(r.history_id);
      if (!id || (await ctx.db.query("student_class_history").withIndex("by_history_id", (q) => q.eq("history_id", id)).unique())) return false;
      await ctx.db.insert("student_class_history", {
        history_id: id, student_id: S(r.student_id), class_id: S(r.class_id), academic_year: S(r.academic_year),
        start_date: S(r.start_date), end_date: S(r.end_date), is_active: B(r.is_active), created_at: S(r.created_at),
      });
      return true;
    }
    case "Attendance": {
      const id = S(r.attendance_id);
      if (!id || (await ctx.db.query("attendance").withIndex("by_attendance_id", (q) => q.eq("attendance_id", id)).unique())) return false;
      await ctx.db.insert("attendance", {
        attendance_id: id, attendance_date: S(r.attendance_date).slice(0, 10), student_id: S(r.student_id), class_id: S(r.class_id),
        status: S(r.status), notes: S(r.notes), recorded_by: S(r.recorded_by), created_at: S(r.created_at), updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Settings": {
      const key = S(r.setting_key);
      if (!key) return false;
      const ex = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("setting_key", key)).unique();
      if (ex) return false;
      await ctx.db.insert("settings", { setting_key: key, setting_value: S(r.setting_value), updated_at: S(r.updated_at) });
      return true;
    }
    case "Assignments": {
      const id = S(r.assignment_id);
      if (!id || (await ctx.db.query("assignments").withIndex("by_assignment_id", (q) => q.eq("assignment_id", id)).unique())) return false;
      await ctx.db.insert("assignments", {
        assignment_id: id, title: S(r.title), description: S(r.description), class_id: S(r.class_id), due_at: S(r.due_at),
        duration_minutes: N(r.duration_minutes), is_published: B(r.is_published), created_by: S(r.created_by),
        created_at: S(r.created_at), updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Questions": {
      const id = S(r.question_id);
      if (!id || (await ctx.db.query("questions").withIndex("by_question_id", (q) => q.eq("question_id", id)).unique())) return false;
      const type = S(r.type) === "esai" ? "esai" : "pilihan_ganda";
      await ctx.db.insert("questions", {
        question_id: id, assignment_id: S(r.assignment_id), type, text: S(r.text), options: J(r.options),
        correct_index: type === "esai" ? null : NN(r.correct_index), points: N(r.points, 1), order_no: N(r.order_no),
        created_at: S(r.created_at), updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Submissions": {
      const id = S(r.submission_id);
      if (!id || (await ctx.db.query("submissions").withIndex("by_submission_id", (q) => q.eq("submission_id", id)).unique())) return false;
      const st = S(r.status);
      const status = st === "dinilai" || st === "diserahkan" ? st : "berlangsung";
      await ctx.db.insert("submissions", {
        submission_id: id, assignment_id: S(r.assignment_id), student_id: S(r.student_id), status,
        started_at: N(r.started_at), submitted_at: NN(r.submitted_at), auto_score: NN(r.auto_score), manual_score: NN(r.manual_score),
        total_score: NN(r.total_score), max_score: N(r.max_score), graded_by: S(r.graded_by), graded_at: NN(r.graded_at),
        updated_at: S(r.updated_at),
      });
      return true;
    }
    case "Answers": {
      const id = S(r.answer_id);
      if (!id || (await ctx.db.query("answers").withIndex("by_answer_id", (q) => q.eq("answer_id", id)).unique())) return false;
      await ctx.db.insert("answers", {
        answer_id: id, submission_id: S(r.submission_id), question_id: S(r.question_id), answer: S(r.answer),
        is_correct: r.is_correct === "" || r.is_correct === null || r.is_correct === undefined ? null : B(r.is_correct),
        score: NN(r.score), feedback: S(r.feedback),
      });
      return true;
    }
    default:
      return fail("Tabel tidak dikenal: " + table);
  }
}

export const importRows = mutation({
  args: { secret: v.string(), table: v.string(), rows: v.array(v.any()) },
  handler: async (ctx, { secret, table, rows }) => {
    const expected = process.env.IMPORT_SECRET;
    if (!expected) fail("IMPORT_SECRET belum diset di environment Convex.");
    if (secret !== expected) fail("Secret impor salah.");
    if (rows.length > 500) fail("Maksimal 500 baris per panggilan.");

    let skipped = 0;
let inserted = 0;

for (const r of rows as Row[]) {
  const ok = await importOne(ctx, table, r);
  if (ok) {
    inserted++;
  } else {
    skipped++;
  }
}

return { table, inserted, skipped };
  },
});