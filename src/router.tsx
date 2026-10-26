import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { PageSpinner } from '~/components/ui'
import { qk } from '~/lib/queries'

export function getRouter() {
  // Sesi berakhir di mana pun terdeteksi -> kembali ke halaman login
  const onAuthError = (error: unknown) => {
    if (typeof window === 'undefined') return
    if (error instanceof Error && error.message.includes('AUTH_FAILED')) {
      queryClient.removeQueries({ queryKey: qk.me })
      router.navigate({ to: '/login' })
    }
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onAuthError }),
    mutationCache: new MutationCache({ onError: onAuthError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSpinner,
    defaultPendingMs: 150,
    defaultErrorComponent: ({ error }) => {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      return (
        <div className="p-6">
          <div role="alert" className="alert alert-error alert-soft">{message}</div>
        </div>
      )
    }
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}