import { queryOptions } from '@tanstack/react-query'
import { getMeFn, getPublicSettingsFn } from '~/server/functions'
import { api } from './api'
import type { ReportFilters } from './types'

export const qk = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  students: ['students'] as const,
  classes: ['classes'] as const,
  teachers: ['teachers'] as const,
  dashboard: ['dashboard'] as const,
  attendance: ['attendance'] as const,
  report: ['report'] as const,
  my: ['my-attendance'] as const,
}

export const meQuery = queryOptions({
  queryKey: qk.me,
  queryFn: () => getMeFn(),
  staleTime: 5 * 60_000,
})

export const publicSettingsQuery = queryOptions({
  queryKey: [...qk.settings, 'public'],
  queryFn: () => getPublicSettingsFn(),
  staleTime: 10 * 60_000,
})

export const settingsQuery = queryOptions({
  queryKey: [...qk.settings, 'private'],
  queryFn: () => api.settings(),
  staleTime: 5 * 60_000,
})

export const studentsQuery = queryOptions({ queryKey: qk.students, queryFn: api.students })
export const classesQuery = queryOptions({ queryKey: qk.classes, queryFn: api.classes })
export const teachersQuery = queryOptions({ queryKey: qk.teachers, queryFn: api.teachers })
export const dashboardQuery = queryOptions({ queryKey: qk.dashboard, queryFn: api.dashboard, staleTime: 15_000 })

export const attendanceFormQuery = (date: string, classId: string) =>
  queryOptions({
    queryKey: [...qk.attendance, date, classId],
    queryFn: () => api.attendanceForm(date, classId),
    staleTime: 0,
  })

export const reportQuery = (f: ReportFilters) =>
  queryOptions({ queryKey: [...qk.report, f], queryFn: () => api.report(f), staleTime: 0 })

export const myAttendanceQuery = (f: { startDate: string; endDate: string }) =>
  queryOptions({ queryKey: [...qk.my, f], queryFn: () => api.myAttendance(f), staleTime: 0 })