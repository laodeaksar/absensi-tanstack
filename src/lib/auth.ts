import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { meQuery } from './queries'
import type { Role, SessionUser } from './types'

export type HomePath = '/dashboard' | '/my-attendance'

export const homeFor = (u: SessionUser): HomePath => (u.role === 'siswa' ? '/my-attendance' : '/dashboard')

export async function requireUser(ctx: { queryClient: QueryClient }) {
  const me = await ctx.queryClient.ensureQueryData(meQuery)
  if (!me) throw redirect({ to: '/login' })
  return me
}

/** Lempar redirect ke beranda jika peran tidak diizinkan. */
export function allowRoles(me: SessionUser, roles: Role[]) {
  if (!roles.includes(me.role)) throw redirect({ to: homeFor(me) })
}