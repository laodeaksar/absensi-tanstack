export type Role = 'admin' | 'guru' | 'siswa'
export type Flag = boolean | string

export const isActive = (v: unknown) => v === true || v === 'TRUE' || v === 'true'

export interface SessionUser {
  user_id: string
  username: string
  full_name: string
  role: Role
  assigned_classes: string
  student_id: string
  must_change_password: boolean
}

export interface Student {
  student_id: string
  nis: string
  nisn: string
  full_name: string
  gender: string
  is_active: Flag
}

export interface ClassRow {
  class_id: string
  class_name: string
  grade_level: string
  academic_year: string
  homeroom_teacher: string
  is_active: Flag
}

export interface Teacher {
  user_id: string
  username: string
  full_name: string
  nip: string
  phone: string
  email: string
  assigned_classes: string
  is_active: Flag
}

export interface Settings {
  school_name: string
  school_address: string
  principal_name: string
  principal_nip: string
  active_academic_year: string
  edit_window_days: string
}

export interface DashboardData {
  stats: {
    totalStudents: number
    totalClasses: number
    hadir: number
    sakit: number
    izin: number
    alpa: number
    persentase: number | string
  }
  chartData: { labels: string[]; hadir: number[]; tidakHadir: number[] }
}

export interface AttendanceEntry {
  student_id: string
  nis: string
  full_name: string
  status: string
  notes: string
  attendance_id: string | null
}

export interface ReportRow {
  date: string
  student_name: string
  nis: string
  class_name: string
  status: string
  notes: string
}

export interface ReportFilters {
  startDate?: string
  endDate?: string
  classId?: string
}

export interface MyAttendance {
  profile: { full_name: string; nis: string; class_name: string }
  today: { status: string; notes: string } | null
  summary: { hadir: number; sakit: number; izin: number; alpa: number; persentase: number | string }
  records: { date: string; status: string; notes: string; class_name: string }[]
}

export type StudentInput = {
  student_id?: string
  nis: string
  nisn: string
  full_name: string
  gender: string
  class_id?: string
}

export type ClassInput = {
  class_id?: string
  class_name: string
  grade_level: string
  academic_year: string
  homeroom_teacher: string
}

export type TeacherInput = {
  user_id?: string
  full_name?: string
  nip?: string
  phone?: string
  email?: string
  username?: string
  password?: string
  assigned_classes?: string[]
  is_active?: boolean
}

export function parseClassIds(v: string | undefined): string[] {
  try {
    const a = JSON.parse(v || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}