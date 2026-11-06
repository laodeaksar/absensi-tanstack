import { queryOptions } from "@tanstack/react-query";

import { getMeFn, getPublicSettingsFn } from "~/server/functions";

import type { ReportFilters } from "./types";

import { api } from "./api";

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
  queryKey: [...qk.settings, "private"],
  queryFn: () => api.settings(),
  staleTime: 5 * 60_000,
});

export const studentsQuery = queryOptions({
  queryKey: qk.students,
  queryFn: () => api.students(),
});
export const studentClassesQuery = queryOptions({
  queryKey: qk.studentClasses,
  queryFn: () => api.studentClasses(),
  staleTime: 60_000,
});
export const classesQuery = queryOptions({
  queryKey: qk.classes,
  queryFn: () => api.classes(),
});
export const teachersQuery = queryOptions({
  queryKey: qk.teachers,
  queryFn: () => api.teachers(),
});
export const dashboardQuery = queryOptions({
  queryKey: qk.dashboard,
  queryFn: () => api.dashboard(),
  staleTime: 15_000,
});

export const attendanceFormQuery = (date: string, classId: string) =>
  queryOptions({
    queryKey: [...qk.attendance, date, classId],
    queryFn: () => api.attendanceForm(date, classId),
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
    queryKey: [...qk.my, f],
    queryFn: () => api.myAttendance(f),
    staleTime: 0,
  });

export const assignmentsQuery = queryOptions({
  queryKey: qk.list,
  queryFn: () => api.list(),
  staleTime: 10_000,
});

export const assignmentDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.detail(id),
    queryFn: () => api.detail(id),
    staleTime: 0,
  });

export const submissionsQuery = (id: string) =>
  queryOptions({
    queryKey: qk.subs(id),
    queryFn: () => api.submissions(id),
    staleTime: 0,
  });

export const reviewQuery = (submissionId: string) =>
  queryOptions({
    queryKey: qk.review(submissionId),
    queryFn: () => api.review(submissionId),
    staleTime: 0,
  });

export const myTasksQuery = queryOptions({
  queryKey: qk.myTasks,
  queryFn: () => api.myTasks(),
  staleTime: 0,
});

export const myResultQuery = (id: string) =>
  queryOptions({
    queryKey: qk.result(id),
    queryFn: () => api.myResult(id),
    staleTime: 0,
  });
  
export const subjectsQuery = queryOptions({
  queryKey: qk.subjects,
  queryFn: () => api.subjects(),
});

export const teachingQuery = queryOptions({
  queryKey: qk.teaching,
  queryFn: () => api.teaching(),
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
  