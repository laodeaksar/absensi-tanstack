import type { RpcName } from "~/server/functions";

import { rpcFn } from "~/server/functions";

import type {
  AttendanceEntry,
  ClassInput,
  ClassRow,
  DashboardData,
  MyAttendance,
  MySubjectAttendance,
  ReportFilters,
  ReportRow,
  Settings,
  Student,
  StudentClass,
  StudentInput,
  Subject,
  SubjectInput,
  SubjectReport,
  SubjectReportFilters,
  Teacher,
  TeacherInput,
  TeachingInput,
  TeachingRow,
  AnswerInput,
  Assignment,
  AssignmentDetail,
  AssignmentInput,
  GradeInput,
  MyResult,
  MyTask,
  QuestionInput,
  ReviewData,
  SubmissionList,
  TaskSession,
} from "./types";

async function rpc<T>(fn: RpcName, ...args: unknown[]): Promise<T> {
  return (await rpcFn({
    data: { fn, args },
  })) as T;
}

type Msg = { message: string };

export const api = {
  classes: () =>
    rpc<{ data: ClassRow[] }>("fetchMasterData", "classes").then((r) => r.data),
  students: () =>
    rpc<{ data: Student[] }>("fetchMasterData", "students").then((r) => r.data),
  teachers: () =>
    rpc<{ data: Teacher[] }>("fetchMasterData", "teachers").then((r) => r.data),

  saveStudent: (d: StudentInput) => rpc<Msg>("saveStudent", d),
  studentClasses: () => rpc<StudentClass[]>("listStudentClasses"),
  moveStudent: (studentId: string, classId: string) =>
    rpc<Msg>("moveStudent", studentId, classId),
  saveClass: (d: ClassInput) => rpc<Msg>("saveClass", d),
  saveTeacher: (d: TeacherInput) => rpc<Msg>("saveTeacher", d),
  generateStudentAccounts: () => rpc<Msg>("generateStudentAccounts"),
  resetStudentAccount: (studentId: string) =>
    rpc<Msg>("resetStudentAccount", studentId),

  attendanceForm: (date: string, classId: string) =>
    rpc<{ data: AttendanceEntry[] }>("getAttendanceForm", date, classId).then(
      (r) => r.data,
    ),
  submitAttendance: (
    date: string,
    classId: string,
    rows: {
      student_id: string;
      status: string;
      notes: string;
    }[],
  ) => rpc<Msg>("submitAttendanceBatch", date, classId, rows),

  subjects: () => rpc<{ data: Subject[] }>("listSubjects").then((r) => r.data),
  saveSubject: (d: SubjectInput) => rpc<Msg>("saveSubject", d),
  deleteSubject: (id: string) => rpc<Msg>("deleteSubject", id),
  /** Admin: semua pengampu. Guru: hanya miliknya sendiri. */
  teaching: () =>
    rpc<{ data: TeachingRow[] }>("listTeaching").then((r) => r.data),
  saveTeaching: (d: TeachingInput) => rpc<Msg>("saveTeaching", d),
  deleteTeaching: (id: string) => rpc<Msg>("deleteTeaching", id),
  subjectAttendanceForm: (date: string, classId: string, subjectId: string) =>
    rpc<{ data: AttendanceEntry[] }>(
      "getSubjectAttendanceForm",
      date,
      classId,
      subjectId,
    ).then((r) => r.data),
  submitSubjectAttendance: (
    date: string,
    classId: string,
    subjectId: string,
    rows: { student_id: string; status: string; notes: string }[],
  ) => rpc<Msg>("submitSubjectAttendance", date, classId, subjectId, rows),
  mySubjectAttendance: (f: { startDate: string; endDate: string }) =>
    rpc<MySubjectAttendance>("getMySubjectAttendance", f),
  subjectReport: (f: SubjectReportFilters) =>
    rpc<SubjectReport>("getSubjectReportData", f),

  dashboard: () => rpc<DashboardData>("getDashboardStats"),
  report: (f: ReportFilters) =>
    rpc<{ data: ReportRow[] }>("getReportData", {
      startDate: f.startDate ?? "",
      endDate: f.endDate ?? "",
      classId: f.classId ?? "",
    }).then((r) => r.data),
  myAttendance: (f: { startDate: string; endDate: string }) =>
    rpc<MyAttendance>("getMyAttendance", f),

  list: () =>
    rpc<{ data: Assignment[] }>("listAssignments").then((r) => r.data),
  saveAssignment: (d: AssignmentInput) =>
    rpc<Msg & { assignment_id: string }>("saveAssignment", d),
  deleteAssignment: (id: string) => rpc<Msg>("deleteAssignment", id),
  setPublished: (id: string, published: boolean) =>
    rpc<Msg & { is_published: boolean }>(
      "setAssignmentPublished",
      id,
      published,
    ),
  detail: (id: string) => rpc<AssignmentDetail>("getAssignmentDetail", id),
  saveQuestion: (d: QuestionInput) => rpc<Msg>("saveQuestion", d),
  deleteQuestion: (id: string) => rpc<Msg>("deleteQuestion", id),
  submissions: (id: string) => rpc<SubmissionList>("listSubmissions", id),
  review: (submissionId: string) =>
    rpc<ReviewData>("getSubmissionForReview", submissionId),
  grade: (submissionId: string, grades: GradeInput[]) =>
    rpc<Msg>("gradeSubmission", submissionId, grades),

  myTasks: () => rpc<{ data: MyTask[] }>("listMyTasks").then((r) => r.data),
  start: (id: string) => rpc<TaskSession>("startTask", id),
  submit: (id: string, answers: AnswerInput[]) =>
    rpc<Msg & { status: string }>("submitTask", id, answers),
  /** Simpan draf jawaban (autosave). ok=false: pengerjaan sudah ditutup/habis, hentikan autosave. */
  saveDraft: (id: string, answers: AnswerInput[]) =>
    rpc<{ ok: boolean; saved: number }>("saveDraft", id, answers),
  myResult: (id: string) => rpc<MyResult>("getMyResult", id),

  settings: () =>
    rpc<{ settings: Settings }>("getSettings").then((r) => r.settings),
  saveSettings: (d: Partial<Settings>) => rpc<Msg>("saveSettings", d),
  changePassword: (oldPassword: string, newPassword: string) =>
    rpc<Msg>("changePassword", oldPassword, newPassword),
};
