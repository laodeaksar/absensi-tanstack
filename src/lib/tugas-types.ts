import type { Flag } from './types'

export type QuestionType = 'pilihan_ganda' | 'esai'
export type SubmissionStatus = 'belum' | 'berlangsung' | 'diserahkan' | 'dinilai'

export interface Assignment {
  assignment_id: string
  title: string
  description: string
  class_id: string
  class_name: string
  /** 'yyyy-MM-ddTHH:mm' atau '' */
  due_at: string
  duration_minutes: number
  is_published: Flag
  question_count: number
  started_count: number
  submitted_count: number
  pending_count: number
}

export interface Question {
  question_id: string
  type: QuestionType
  text: string
  options: string[]
  correct_index: number | ''
  points: number
  order_no: number
}

export interface AssignmentDetail {
  assignment: Assignment
  questions: Question[]
  locked: boolean
  max_score: number
}

export interface SubmissionRow {
  student_id: string
  nis: string
  full_name: string
  status: SubmissionStatus
  submission_id: string
  score: number | ''
  max_score: number
  nilai: number | ''
  submitted_at: number | ''
}

export interface SubmissionList {
  assignment: { assignment_id: string; title: string; class_name: string; max_score: number }
  data: SubmissionRow[]
}

export interface ReviewAnswer {
  question: Question
  answer: string
  is_correct: boolean | null
  score: number | ''
  feedback: string
}

export interface ReviewData {
  submission: { submission_id: string; status: SubmissionStatus; auto_score: number; total_score: number | ''; max_score: number; submitted_at: number }
  student: { full_name: string; nis: string }
  assignment: { assignment_id: string; title: string; class_name: string }
  answers: ReviewAnswer[]
}

export interface MyTask {
  assignment_id: string
  title: string
  description: string
  class_name: string
  due_at: string
  duration_minutes: number
  question_count: number
  max_score: number
  status: SubmissionStatus
  score: number | ''
  nilai: number | ''
}

export interface StudentQuestion {
  question_id: string
  type: QuestionType
  text: string
  options: string[]
  points: number
  order_no: number
}

export interface TaskSession {
  submission_id: string
  assignment: { assignment_id: string; title: string; description: string; duration_minutes: number; due_at: string }
  questions: StudentQuestion[]
  started_at: number
  /** epoch ms; 0 = tanpa batas */
  deadline: number
  server_now: number
}

export interface MyResult {
  title: string
  status: SubmissionStatus
  score?: number
  max_score?: number
  nilai?: number
  mcq?: { correct: number; total: number; score: number; max: number }
  essay?: { total: number; score: number; max: number }
  feedbacks?: { no: number; points: number; score: number; text: string }[]
}

export type AssignmentInput = {
  assignment_id?: string
  title: string
  description: string
  class_id: string
  due_at: string
  duration_minutes: number
  is_published: boolean
}

export type QuestionInput = {
  question_id?: string
  assignment_id: string
  type: QuestionType
  text: string
  options: string[]
  correct_index: number | ''
  points: number
}

export type GradeInput = { question_id: string; score: string; feedback: string }
export type AnswerInput = { question_id: string; answer: string }