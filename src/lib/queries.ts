import { convexQuery } from "@convex-dev/react-query";
import { queryOptions } from "@tanstack/react-query";

import { api as convexApi } from "~/convex/_generated/api";
import { getMeFn, getPublicSettingsFn } from "~/server/functions";

import type {
  Assignment,
  ClassRow,
  DashboardData,
  GradeBook,
  GradeSemester,
  MyAttendance,
  MyGrades,
  MyResult,
  MySubjectAttendance,
  MyTask,
  ReportFilters,
  Settings,
  Student,
  StudentClass,
  StudentDetail,
  Subject,
  SubjectReportFilters,
  SubmissionList,
  Teacher,
  TeachingRow,
} from "./types";

import { api } from "./api";

/**
 * Query bertanda "realtime" memakai convexQuery(): berlangganan lewat websocket, jadi data
 * ikut berubah saat ada tulisan baru dan tidak perlu invalidateQueries. Auth lewat JWT
 * (lihat router.tsx), bukan token argumen.
 *
 * Tetap lewat RPC (api.*) dengan sengaja:
 *  - form yang diedit pengguna (absensi, penilaian): pembaruan realtime bisa menimpa isian,
 *  - laporan besar: langganan akan dihitung ulang di setiap tulisan absensi,
 *  - me / pengaturan publik: dipakai guard rute di SSR dan harus mengembalikan null, bukan error.
 */
const unwrap = <T>(r: { data: unknown }) => r.data as T;

export const qk = {
  me: ["me"] as const,
  settings: ["settings"] as const,
  students: ["students"] as const,
  studentClasses: ["student-classes"] as const,
  classes: ["classes"] as const,
  teachers: ["teachers"] as const,
  dashboard: ["dashboard"] as const,
  attendance: ["attendance"] as const,
  report: ["report"] as const,
  my: ["my-attendance"] as const,
  list: ["assignments"] as const,
  detail: (id: string) => ["assignments", id, "detail"] as const,
  subs: (id: string) => ["assignments", id, "subs"] as const,
  review: (id: string) => ["review", id] as const,
  subjects: ["subjects"] as const,
  teaching: ["teaching"] as const,
  subjectAttendance: ["subject-attendance"] as const,
  subjectReport: ["subject-report"] as const,
  mySubjectAttendance: ["my-subject-attendance"] as const,
  myTasks: ["my-tasks"] as const,
  result: (id: string) => ["my-result", id] as const,
};

export const meQuery = queryOptions({
  queryKey: qk.me,
  queryFn: () => getMeFn(),
  staleTime: 5 * 60_000,
});

export const publicSettingsQuery = queryOptions({
  queryKey: [...qk.settings, "public"],
  queryFn: () => getPublicSettingsFn(),
  staleTime: 10 * 60_000,
});

export const settingsQuery = queryOptions({
  ...convexQuery(convexApi.settings.getSettings, {}),
  select: (r): Settings => r.settings as unknown as Settings,
});

export const studentsQuery = queryOptions({
  ...convexQuery(convexApi.master.fetchMasterData, { type: "students" }),
  select: unwrap<Student[]>,
});
export const studentDetailQuery = (studentId: string) =>
  queryOptions({
    ...convexQuery(convexApi.master.getStudentDetail, { studentId }),
    select: (r): StudentDetail => r as StudentDetail,
  });
export const studentClassesQuery = queryOptions({
  ...convexQuery(convexApi.master.listStudentClasses, {}),
  select: (r): StudentClass[] => r as StudentClass[],
});
export const classesQuery = queryOptions({
  ...convexQuery(convexApi.master.fetchMasterData, { type: "classes" }),
  select: unwrap<ClassRow[]>,
});
export const teachersQuery = queryOptions({
  ...convexQuery(convexApi.master.fetchMasterData, { type: "teachers" }),
  select: unwrap<Teacher[]>,
});
export const dashboardQuery = queryOptions({
  ...convexQuery(convexApi.attendance.getDashboardStats, {}),
  select: (r): DashboardData => r as DashboardData,
});

export const attendanceFormQuery = (
  date: string,
  classId: string,
  subjectId?: string,
) =>
  queryOptions({
    queryKey: subjectId
      ? [...qk.subjectAttendance, date, classId, subjectId]
      : [...qk.attendance, date, classId],
    queryFn: () =>
      subjectId
        ? api.subjectAttendanceForm(date, classId, subjectId)
        : api.attendanceForm(date, classId),
    staleTime: 0,
  });

export const reportQuery = (f: ReportFilters) =>
  queryOptions({
    queryKey: [...qk.report, f],
    queryFn: () => api.report(f),
    staleTime: 0,
  });

export const myAttendanceQuery = (f: { startDate: string; endDate: string }) =>
  queryOptions({
    ...convexQuery(convexApi.attendance.getMyAttendance, { filters: f }),
    select: (r): MyAttendance => r as MyAttendance,
  });

export const assignmentsQuery = queryOptions({
  ...convexQuery(convexApi.assignment.listAssignments, {}),
  select: unwrap<Assignment[]>,
});

export const assignmentDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.detail(id),
    queryFn: () => api.detail(id),
    staleTime: 0,
  });

export const submissionsQuery = (id: string) =>
  queryOptions({
    ...convexQuery(convexApi.assignment.listSubmissions, { assignmentId: id }),
    select: (r): SubmissionList => r as SubmissionList,
  });

export const reviewQuery = (submissionId: string) =>
  queryOptions({
    queryKey: qk.review(submissionId),
    queryFn: () => api.review(submissionId),
    staleTime: 0,
  });

export const myTasksQuery = queryOptions({
  ...convexQuery(convexApi.assignment.listMyTasks, {}),
  select: unwrap<MyTask[]>,
});

export const myResultQuery = (id: string) =>
  queryOptions({
    ...convexQuery(convexApi.assignment.getMyResult, { assignmentId: id }),
    select: (r): MyResult => r as unknown as MyResult,
  });

export const subjectsQuery = queryOptions({
  ...convexQuery(convexApi.subjects.listSubjects, {}),
  select: unwrap<Subject[]>,
});

export const teachingQuery = queryOptions({
  ...convexQuery(convexApi.subjects.listTeaching, {}),
  select: unwrap<TeachingRow[]>,
});

export const teacherAssignmentsQuery = (teacherId: string) =>
  queryOptions({
    ...convexQuery(convexApi.assignment.listAssignmentsByTeacher, {
      teacherId,
    }),
    select: unwrap<
      (Pick<
        Assignment,
        | "assignment_id"
        | "title"
        | "class_name"
        | "subject_name"
        | "due_at"
        | "is_published"
      > & { is_creator: boolean; creator_name: string })[]
    >,
  });

export const subjectAttendanceFormQuery = (
  date: string,
  classId: string,
  subjectId: string,
) =>
  queryOptions({
    queryKey: [...qk.subjectAttendance, date, classId, subjectId],
    queryFn: () => api.subjectAttendanceForm(date, classId, subjectId),
    staleTime: 0,
  });

export const subjectReportQuery = (f: SubjectReportFilters) =>
  queryOptions({
    queryKey: [...qk.subjectReport, f],
    queryFn: () => api.subjectReport(f),
    staleTime: 0,
  });

export const mySubjectAttendanceQuery = (f: {
  startDate: string;
  endDate: string;
}) =>
  queryOptions({
    ...convexQuery(convexApi.subjects.getMySubjectAttendance, { filters: f }),
    select: (r): MySubjectAttendance => r as MySubjectAttendance,
  });

export const gradeBookQuery = (a: {
  classId: string;
  subjectId: string;
  academicYear: string;
  semester: GradeSemester;
}) =>
  queryOptions({
    ...convexQuery(convexApi.grades.getGradeBook, a),
    select: (r): GradeBook => r as GradeBook,
  });

export const myGradesQuery = (a: {
  academicYear: string;
  semester: GradeSemester;
}) =>
  queryOptions({
    ...convexQuery(convexApi.grades.getMyGrades, a),
    select: (r): MyGrades => r as MyGrades,
  });
