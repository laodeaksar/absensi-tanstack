export type Role = "admin" | "guru" | "siswa";

export const isActive = (v: boolean) => v;

export interface SessionUser {
  user_id: string;
  username: string;
  full_name: string;
  role: Role;
  assigned_classes: string[];
  student_id: string;
  must_change_password: boolean;
}

export interface Student {
  student_id: string;
  nis: string;
  nisn: string;
  full_name: string;
  gender: string;
  is_active: boolean;
}

export interface StudentClass {
  student_id: string;
  class_id: string;
  academic_year: string;
  start_date: string;
}

export interface ClassRow {
  class_id: string;
  class_name: string;
  grade_level: string;
  academic_year: string;
  homeroom_teacher: string;
  is_active: boolean;
}

export interface Teacher {
  user_id: string;
  username: string;
  full_name: string;
  nip: string;
  phone: string;
  email: string;
  assigned_classes: string[];
  is_active: boolean;
}

export interface Settings {
  school_name: string;
  active_academic_year: string;
  /** Selisih zona waktu sekolah dari UTC (menit); turunan server, tidak disimpan. */
  tz_offset_minutes: string;
  // Hanya dikirim ke admin dan guru
  school_address?: string;
  principal_name?: string;
  principal_nip?: string;
  edit_window_days?: string;
}

export interface DashboardData {
  stats: {
    totalStudents: number;
    totalClasses: number;
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    persentase: number | string;
  };
  chartData: {
    labels: string[];
    hadir: number[];
    tidakHadir: number[];
  };
}

export interface AttendanceEntry {
  student_id: string;
  nis: string;
  full_name: string;
  status: string;
  notes: string;
  attendance_id: string | null;
}

export interface ReportRow {
  date: string;
  student_name: string;
  nis: string;
  class_name: string;
  status: string;
  notes: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  classId?: string;
}

export interface MyAttendance {
  profile: {
    full_name: string;
    nis: string;
    class_name: string;
  };
  today: {
    status: string;
    notes: string;
  } | null;
  summary: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    persentase: number | string;
  };
  records: {
    date: string;
    status: string;
    notes: string;
    class_name: string;
  }[];
}

export type StudentInput = {
  student_id?: string;
  nis: string;
  nisn: string;
  full_name: string;
  gender: string;
  class_id?: string;
};

export type ClassInput = {
  class_id?: string;
  class_name: string;
  grade_level: string;
  academic_year: string;
  homeroom_teacher: string;
  /** Hanya dikirim saat edit; kelas baru selalu aktif */
  is_active?: boolean;
};

export type TeacherInput = {
  user_id?: string;
  full_name?: string;
  nip?: string;
  phone?: string;
  email?: string;
  username?: string;
  password?: string;
  assigned_classes?: string[];
  is_active?: boolean;
};

export type QuestionType = "pilihan_ganda" | "esai";
export type SubmissionStatus =
  | "belum"
  | "berlangsung"
  | "diserahkan"
  | "dinilai";

export interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  class_id: string;
  class_name: string;
  /** 'yyyy-MM-ddTHH:mm' atau '' */
  due_at: string;
  duration_minutes: number;
  is_published: boolean;
  question_count: number;
  started_count: number;
  submitted_count: number;
  pending_count: number;
}

export interface Question {
  question_id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correct_index: number | "";
  points: number;
  order_no: number;
}

export interface AssignmentDetail {
  assignment: Assignment;
  questions: Question[];
  locked: boolean;
  max_score: number;
}

export interface SubmissionRow {
  student_id: string;
  nis: string;
  full_name: string;
  status: SubmissionStatus;
  submission_id: string;
  score: number | "";
  max_score: number;
  nilai: number | "";
  submitted_at: number | "";
}

export interface SubmissionList {
  assignment: {
    assignment_id: string;
    title: string;
    class_name: string;
    max_score: number;
  };
  data: SubmissionRow[];
}

export interface ReviewAnswer {
  question: Question;
  answer: string;
  is_correct: boolean | null;
  score: number | "";
  feedback: string;
}

export interface ReviewData {
  submission: {
    submission_id: string;
    status: SubmissionStatus;
    auto_score: number;
    total_score: number | "";
    max_score: number;
    submitted_at: number;
  };
  student: {
    full_name: string;
    nis: string;
  };
  assignment: {
    assignment_id: string;
    title: string;
    class_name: string;
  };
  answers: ReviewAnswer[];
}

export interface MyTask {
  assignment_id: string;
  title: string;
  description: string;
  class_name: string;
  due_at: string;
  duration_minutes: number;
  question_count: number;
  max_score: number;
  status: SubmissionStatus;
  score: number | "";
  nilai: number | "";
}

export interface StudentQuestion {
  question_id: string;
  type: QuestionType;
  text: string;
  options: string[];
  points: number;
  order_no: number;
}

export interface TaskSession {
  submission_id: string;
  assignment: {
    assignment_id: string;
    title: string;
    description: string;
    duration_minutes: number;
    due_at: string;
  };
  questions: StudentQuestion[];
  started_at: number;
  /** epoch ms; 0 = tanpa batas */
  deadline: number;
  server_now: number;
  /** Draf jawaban tersimpan (question_id -> jawaban) untuk melanjutkan pengerjaan */
  saved_answers: Record<string, string>;
}

export interface MyResult {
  title: string;
  status: SubmissionStatus;
  score?: number;
  max_score?: number;
  nilai?: number;
  mcq?: {
    correct: number;
    total: number;
    score: number;
    max: number;
  };
  essay?: {
    total: number;
    score: number;
    max: number;
  };
  feedbacks?: {
    no: number;
    points: number;
    score: number;
    text: string;
  }[];
}

export type AssignmentInput = {
  assignment_id?: string;
  title: string;
  description: string;
  class_id: string;
  due_at: string;
  duration_minutes: number;
  is_published: boolean;
};

export type QuestionInput = {
  question_id?: string;
  assignment_id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correct_index: number | "";
  points: number;
};

export type GradeInput = {
  question_id: string;
  score: string;
  feedback: string;
};
export type AnswerInput = {
  question_id: string;
  answer: string;
};
