import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { callGas } from './gas.server'
import type { SessionUser } from '~/lib/types'

const TOKEN_COOKIE = 'eduabsen_token'
const SIX_HOURS = 60 * 60 * 6

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SIX_HOURS,
  }
}

// Daftar fungsi Apps Script yang boleh dipanggil dari browser (token disisipkan server).
export const GAS_FUNCTIONS = [
  'fetchMasterData',
  'saveStudent',
  'saveClass',
  'saveTeacher',
  'generateStudentAccounts',
  'resetStudentAccount',
  'getAttendanceForm',
  'submitAttendanceBatch',
  'getDashboardStats',
  'getReportData',
  'getMyAttendance',
  'getSettings',
  'saveSettings',
  'changePassword',
  // Tugas
  'listAssignments',
  'saveAssignment',
  'deleteAssignment',
  'getAssignmentDetail',
  'saveQuestion',
  'deleteQuestion',
  'listSubmissions',
  'getSubmissionForReview',
  'gradeSubmission',
  'listMyTasks',
  'startTask',
  'submitTask',
  'getMyResult',
] as const
export type GasName = (typeof GAS_FUNCTIONS)[number]

const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const token = getCookie(TOKEN_COOKIE)
  if (!token) throw new Error('AUTH_FAILED')
  return next({ context: { token } })
})

/** RPC generik untuk semua endpoint yang butuh login. Token tidak pernah sampai ke browser. */
export const gasRpc = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ fn: z.enum(GAS_FUNCTIONS), args: z.array(z.unknown()) }))
  .handler(async ({ data, context }) => {
    try {
      const res = await callGas<any>(data.fn, [context.token, ...data.args])
      // Setelah ganti password, sesi lama dibatalkan di Apps Script
      if (data.fn === 'changePassword') deleteCookie(TOKEN_COOKIE, { path: '/' })
      return res
    } catch (e) {
      if (e instanceof Error && e.message.includes('AUTH_FAILED')) {
        deleteCookie(TOKEN_COOKIE, { path: '/' })
      }
      throw e
    }
  })

export const loginFn = createServerFn({ method: 'POST' })
  .validator(z.object({ username: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const res = await callGas<{ token: string; user: SessionUser }>('login', [data.username, data.password])
    setCookie(TOKEN_COOKIE, res.token, cookieOptions())
    return res.user
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie(TOKEN_COOKIE)
  if (token) {
    try {
      await callGas('logout', [token])
    } catch {
      /* abaikan: cookie tetap dihapus */
    }
  }
  deleteCookie(TOKEN_COOKIE, { path: '/' })
  return { ok: true }
})

/** Sesi aktif (atau null). Dipakai guard route. */
export const getMeFn = createServerFn({ method: 'GET' }).handler(async (): Promise<SessionUser | null> => {
  const token = getCookie(TOKEN_COOKIE)
  if (!token) return null
  try {
    const res = await callGas<{ user: SessionUser }>('getMe', [token])
    return res.user
  } catch (e) {
    if (e instanceof Error && e.message.includes('AUTH_FAILED')) {
      deleteCookie(TOKEN_COOKIE, { path: '/' })
      return null
    }
    throw e
  }
})

export const getPublicSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const res = await callGas<{ settings: { school_name: string } }>('getPublicSettings')
    return res.settings
  } catch {
    return { school_name: 'EduAbsen' }
  }
})