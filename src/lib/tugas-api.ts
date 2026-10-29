import { gasRpc } from '~/server/functions'
import type { GasName } from '~/server/functions'
import type {
  AnswerInput, Assignment, AssignmentDetail, AssignmentInput, GradeInput, MyResult, MyTask,
  QuestionInput, ReviewData, SubmissionList, TaskSession,
} from './tugas-types'

async function rpc<T>(fn: GasName, ...args: unknown[]): Promise<T> {
  return (await gasRpc({ data: { fn, args } })) as T
}

type Msg = { message: string }

export const tugas = {
  // guru / admin
  list: () => rpc<{ data: Assignment[] }>('listAssignments').then((r) => r.data),
  saveAssignment: (d: AssignmentInput) => rpc<Msg & { assignment_id: string }>('saveAssignment', d),
  deleteAssignment: (id: string) => rpc<Msg>('deleteAssignment', id),
  detail: (id: string) => rpc<AssignmentDetail>('getAssignmentDetail', id),
  saveQuestion: (d: QuestionInput) => rpc<Msg>('saveQuestion', d),
  deleteQuestion: (id: string) => rpc<Msg>('deleteQuestion', id),
  submissions: (id: string) => rpc<SubmissionList>('listSubmissions', id),
  review: (submissionId: string) => rpc<ReviewData>('getSubmissionForReview', submissionId),
  grade: (submissionId: string, grades: GradeInput[]) => rpc<Msg>('gradeSubmission', submissionId, grades),

  // siswa
  myTasks: () => rpc<{ data: MyTask[] }>('listMyTasks').then((r) => r.data),
  start: (id: string) => rpc<TaskSession>('startTask', id),
  submit: (id: string, answers: AnswerInput[]) => rpc<Msg & { status: string }>('submitTask', id, answers),
  myResult: (id: string) => rpc<MyResult>('getMyResult', id),
}