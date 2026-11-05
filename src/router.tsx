import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { PageSpinner } from "~/components/ui";
import { isAuthFailed, isMustChangePassword } from "~/lib/auth-errors";
import { qk } from "~/lib/queries";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  let redirecting = false;

  // Sesi berakhir di mana pun terdeteksi (query atau mutation) -> bersihkan cache, kembali ke login
  const onAuthError = (error: unknown) => {
    if (typeof window === "undefined") return; // SSR: ditangani komponen error rute
    const path = router.state.location.pathname;

    if (isAuthFailed(error)) {
      if (redirecting || path === "/login") return; // beberapa query gagal bersamaan
      redirecting = true;
      // Cache `me` dihapus dulu agar /login tidak mengira pengguna masih masuk. Sisa cache
      // (data pengguna sebelumnya, mungkin di komputer bersama) dikosongkan setelah pindah
      // halaman, saat layout sudah tidak aktif.
      queryClient.removeQueries({ queryKey: qk.me });
      void router.navigate({ to: "/login" }).finally(() => {
        queryClient.clear();
        redirecting = false;
      });
    } else if (isMustChangePassword(error) && path !== "/settings") {
      void router.navigate({ to: "/settings" });
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: onAuthError,
    }),
    mutationCache: new MutationCache({
      onError: onAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSpinner,
    defaultPendingMs: 150,
    defaultErrorComponent: ({ error }) => {
      // Sesi berakhir: pengalihan ke login sedang berjalan, jangan tampilkan kode "AUTH_FAILED"
      if (isAuthFailed(error)) return <PageSpinner />;
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      return (
        <div className="p-6">
          <div
            role="alert"
            className="alert alert-error alert-soft"
          >
            {message}
          </div>
        </div>
      );
    },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}