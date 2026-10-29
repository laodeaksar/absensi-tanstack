import { queryOptions } from '@tanstack/react-query'
import { tugas } from './tugas-api'

export const tk = {
  list: ['assignments'] as const,
  detail: (id: string) => ['assignments', id, 'detail'] as const,
  subs: (id: string) => ['assignments', id, 'subs'] as const,
  review: (id: string) => ['review', id] as const,
  myTasks: ['my-tasks'] as const,
  result: (id: string) => ['my-result', id] as const,
}

export const assignmentsQuery = queryOptions({ queryKey: tk.list, queryFn: tugas.list, staleTime: 10_000 })

export const assignmentDetailQuery = (id: string) =>
  queryOptions({ queryKey: tk.detail(id), queryFn: () => tugas.detail(id), staleTime: 0 })

export const submissionsQuery = (id: string) =>
  queryOptions({ queryKey: tk.subs(id), queryFn: () => tugas.submissions(id), staleTime: 0 })

export const reviewQuery = (submissionId: string) =>
  queryOptions({ queryKey: tk.review(submissionId), queryFn: () => tugas.review(submissionId), staleTime: 0 })

export const myTasksQuery = queryOptions({ queryKey: tk.myTasks, queryFn: tugas.myTasks, staleTime: 0 })

export const myResultQuery = (id: string) =>
  queryOptions({ queryKey: tk.result(id), queryFn: () => tugas.myResult(id), staleTime: 0 })