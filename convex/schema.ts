import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Skema meniru sheet Google Sheets (nama kolom sama, ID berupa string seperti "STD-1A2B3C4D").
 * Ini disengaja: frontend dan migrasi data tidak perlu berubah. Referensi antar tabel memakai
 * field ID string, bukan v.id(), jadi integritas referensi dijaga oleh kode (seperti di Sheets).
 */
export default defineSchema({
  users: defineTable({
    user_id: v.string(),
    username: v.string(),
    username_lc: v.string(),
    // "pbkdf2": hash normal | "sha256": hash lama dari Apps Script (di-upgrade saat login)
    // "nisn": password awal siswa = NISN pada data siswa (belum diganti)
    hash_algo: v.union(
      v.literal("pbkdf2"),
      v.literal("sha256"),
      v.literal("nisn"),
    ),
    password_hash: v.string(),
    password_salt: v.string(),
    hash_iterations: v.optional(v.number()), // jumlah iterasi pbkdf2; kosong = 100000 (hash lama)
    full_name: v.string(),
    role: v.union(v.literal("admin"), v.literal("guru"), v.literal("siswa")),
    assigned_classes: v.array(v.string()),
    is_active: v.boolean(),
    nip: v.string(),
    phone: v.string(),
    email: v.string(),
    student_id: v.string(),
    must_change_password: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_user_id", ["user_id"])
    .index("by_username_lc", ["username_lc"])
    .index("by_student_id", ["student_id"])
    .index("by_nip", ["nip"])
    .index("by_role", ["role"]),

  sessions: defineTable({
    token_hash: v.string(),
    user_id: v.string(),
    expires_at: v.number(),
    created_at: v.number(),
  })
    .index("by_token", ["token_hash"])
    .index("by_user", ["user_id"])
    .index("by_expiry", ["expires_at"]),

  login_attempts: defineTable({
    key: v.string(),
    fails: v.number(),
    last_fail: v.number(),
    locked_until: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_last_fail", ["last_fail"]),

  classes: defineTable({
    class_id: v.string(),
    class_name: v.string(),
    grade_level: v.string(),
    academic_year: v.string(),
    homeroom_teacher: v.string(),
    description: v.string(),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_class_id", ["class_id"])
    .index("by_class_active", ["class_id", "is_active"])
    .index("by_active", ["is_active"]),

  students: defineTable({
    student_id: v.string(),
    nis: v.string(),
    nisn: v.string(),
    full_name: v.string(),
    gender: v.string(),
    birth_place: v.string(),
    birth_date: v.string(),
    address: v.string(),
    parent_name: v.string(),
    parent_phone: v.string(),
    is_active: v.boolean(),
    // type: v.union(v.literal("teachers"),v.literal("classes"),v.literal("students"),),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_student_id", ["student_id"])
    .index("by_nis", ["nis"])
    .index("by_nisn", ["nisn"]),

  student_class_history: defineTable({
    history_id: v.string(),
    student_id: v.string(),
    class_id: v.string(),
    academic_year: v.string(),
    start_date: v.string(),
    end_date: v.string(),
    is_active: v.boolean(),
    created_at: v.string(),
  })
    .index("by_history_id", ["history_id"])
    .index("by_student", ["student_id"])
    .index("by_class", ["class_id"]),

  attendance: defineTable({
    attendance_id: v.string(),
    attendance_date: v.string(), // yyyy-MM-dd
    student_id: v.string(),
    class_id: v.string(),
    status: v.string(),
    notes: v.string(),
    recorded_by: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_attendance_id", ["attendance_id"])
    .index("by_class_date", ["class_id", "attendance_date"])
    .index("by_date", ["attendance_date"])
    .index("by_student", ["student_id", "attendance_date"]),

  /**
   * Ringkasan absensi per kelas per tanggal. Dijaga oleh submitAttendanceBatch (dan dibangun ulang
   * oleh rebuildDay) agar dashboard tidak perlu memindai semua baris absensi.
   */
  attendance_daily: defineTable({
    attendance_date: v.string(), // yyyy-MM-dd
    class_id: v.string(),
    hadir: v.number(),
    sakit: v.number(),
    izin: v.number(),
    alpa: v.number(),
  })
    .index("by_date", ["attendance_date"])
    .index("by_class_date", ["class_id", "attendance_date"]),

  settings: defineTable({
    setting_key: v.string(),
    setting_value: v.string(),
    updated_at: v.string(),
  }).index("by_key", ["setting_key"]),

  /** Mata pelajaran */
  subjects: defineTable({
    subject_id: v.string(),
    code: v.string(), // huruf besar, mis. MTK
    name: v.string(),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_subject_id", ["subject_id"])
    .index("by_code", ["code"]),

  /** Guru pengampu: satu guru per mata pelajaran per kelas */
  teaching: defineTable({
    teaching_id: v.string(),
    class_id: v.string(),
    subject_id: v.string(),
    teacher_id: v.string(), // users.user_id
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_teaching_id", ["teaching_id"])
    .index("by_class_subject", ["class_id", "subject_id"])
    .index("by_teacher", ["teacher_id"])
    .index("by_subject", ["subject_id"]),

  /** Absensi per mata pelajaran; terpisah dari absensi harian (tabel attendance) */
  subject_attendance: defineTable({
    attendance_id: v.string(),
    attendance_date: v.string(), // yyyy-MM-dd
    class_id: v.string(),
    subject_id: v.string(),
    student_id: v.string(),
    status: v.string(),
    notes: v.string(),
    recorded_by: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_class_subject_date", [
      "class_id",
      "subject_id",
      "attendance_date",
    ])
    .index("by_student_subject_date", [
      "student_id",
      "subject_id",
      "attendance_date",
    ])
    .index("by_student_date", ["student_id", "attendance_date"])
    .index("by_subject", ["subject_id"]),

  assignments: defineTable({
    assignment_id: v.string(),
    title: v.string(),
    description: v.string(),
    class_id: v.string(),
    subject_id: v.optional(v.string()), // tugas lama belum bermapel
    due_at: v.string(), // 'yyyy-MM-ddTHH:mm' (waktu lokal sekolah) atau ''
    duration_minutes: v.number(),
    is_published: v.boolean(),
    created_by: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_assignment_id", ["assignment_id"])
    .index("by_class", ["class_id"])
    .index("by_subject", ["subject_id"])
    .index("by_created_by", ["created_by"]),

  questions: defineTable({
    question_id: v.string(),
    assignment_id: v.string(),
    type: v.union(v.literal("pilihan_ganda"), v.literal("esai")),
    text: v.string(),
    options: v.array(v.string()),
    correct_index: v.union(v.number(), v.null()),
    points: v.number(),
    order_no: v.number(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_question_id", ["question_id"])
    .index("by_assignment", ["assignment_id"]),

  submissions: defineTable({
    submission_id: v.string(),
    assignment_id: v.string(),
    student_id: v.string(),
    status: v.union(
      v.literal("berlangsung"),
      v.literal("diserahkan"),
      v.literal("dinilai"),
    ),
    started_at: v.number(),
    submitted_at: v.union(v.number(), v.null()),
    auto_score: v.union(v.number(), v.null()),
    manual_score: v.union(v.number(), v.null()),
    total_score: v.union(v.number(), v.null()),
    max_score: v.number(),
    graded_by: v.string(),
    graded_at: v.union(v.number(), v.null()),
    updated_at: v.string(),
  })
    .index("by_submission_id", ["submission_id"])
    .index("by_assignment", ["assignment_id"])
    .index("by_assignment_student", ["assignment_id", "student_id"])
    .index("by_student", ["student_id"]),

  answers: defineTable({
    answer_id: v.string(),
    submission_id: v.string(),
    question_id: v.string(),
    answer: v.string(),
    is_correct: v.union(v.boolean(), v.null()),
    score: v.union(v.number(), v.null()),
    feedback: v.string(),
  })
    .index("by_answer_id", ["answer_id"])
    .index("by_submission", ["submission_id"]),

  grade_configs: defineTable({
    class_id: v.string(),
    subject_id: v.string(),
    kkm: v.number(),
    components: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        weight: v.number(), // persen, total 100
        source: v.union(v.literal("tugas"), v.literal("manual")),
      }),
    ),
    updated_by: v.string(),
    updated_at: v.string(),
  }).index("by_class_subject", ["class_id", "subject_id"]),

  grade_scores: defineTable({
    class_id: v.string(),
    subject_id: v.string(),
    academic_year: v.string(),
    semester: v.union(v.literal("ganjil"), v.literal("genap")),
    student_id: v.string(),
    component: v.string(),
    score: v.number(),
    updated_by: v.string(),
    updated_at: v.string(),
  })
    .index("by_cell", [
      "class_id",
      "subject_id",
      "academic_year",
      "semester",
      "student_id",
      "component",
    ])
    .index("by_student", ["student_id"]),
});
