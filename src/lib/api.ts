import { gasRpc } from '~/server/functions'
import type { GasName } from '~/server/functions'
import type {
  AttendanceEntry,
  ClassInput,
  ClassRow,
  DashboardData,
  MyAttendance,
  ReportFilters,
  ReportRow,
  Settings,
  Student,
  StudentInput,
  Teacher,
  TeacherInput,
} from './types'

async function rpc<T>(fn: GasName, ...args: unknown[]): Promise<T> {
  return (await gasRpc({ data: { fn, args } })) as T
}

type Msg = { message: string }

export const api = {
  classes: () => rpc<{ data: ClassRow[] }>('fetchMasterData', 'classes').then((r) => r.data),
  students: () => rpc<{ data: Student[] }>('fetchMasterData', 'students').then((r) => r.data),
  teachers: () => rpc<{ data: Teacher[] }>('fetchMasterData', 'teachers').then((r) => r.data),

  saveStudent: (d: StudentInput) => rpc<Msg>('saveStudent', d),
  saveClass: (d: ClassInput) => rpc<Msg>('saveClass', d),
  saveTeacher: (d: TeacherInput) => rpc<Msg>('saveTeacher', d),
  generateStudentAccounts: () => rpc<Msg>('generateStudentAccounts'),
  resetStudentAccount: (studentId: string) => rpc<Msg>('resetStudentAccount', studentId),

  attendanceForm: (date: string, classId: string) =>
    rpc<{ data: AttendanceEntry[] }>('getAttendanceForm', date, classId).then((r) => r.data),
  submitAttendance: (
    date: string,
    classId: string,
    rows: { student_id: string; status: string; notes: string }[],
  ) => rpc<Msg>('submitAttendanceBatch', date, classId, rows),

  dashboard: () => rpc<DashboardData>('getDashboardStats'),
  report: (f: ReportFilters) =>
    rpc<{ data: ReportRow[] }>('getReportData', {
      startDate: f.startDate ?? '',
      endDate: f.endDate ?? '',
      classId: f.classId ?? '',
    }).then((r) => r.data),
  myAttendance: (f: { startDate: string; endDate: string }) => rpc<MyAttendance>('getMyAttendance', f),

  settings: () => rpc<{ settings: Settings }>('getSettings').then((r) => r.settings),
  saveSettings: (d: Partial<Settings>) => rpc<Msg>('saveSettings', d),
  changePassword: (oldPassword: string, newPassword: string) =>
    rpc<Msg>('changePassword', oldPassword, newPassword),
}