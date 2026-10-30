import { createFileRoute, redirect } from '@tanstack/react-router'
import { homeFor } from '~/lib/auth'
import { meQuery } from '~/lib/queries'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery)
    throw redirect({ to: me ? homeFor(me) : '/login' })
  },
})