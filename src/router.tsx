import { ConvexQueryClient } from "@convex-dev/react-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexProvider } from "convex/react";

import { PageSpinner } from "~/components/ui";
import { isAuthFailed, isMustChangePassword } from "~/lib/auth-errors";
import { fetchConvexJwt } from "~/lib/convex-auth";
import { qk } from "~/lib/queries";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  let redirecting = false;

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!CONVEX_URL) throw new Error("VITE_CONVEX_URL belum diatur.");

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);

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
      convexQueryClient.convexClient.clearAuth(); // hentikan langganan realtime milik sesi lama
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
        // Wajib untuk convexQuery(): hash kunci & queryFn bawaan.
        // Query RPC lama tetap jalan karena queryFn-nya sendiri menimpa default ini.
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  // Hubungkan: langganan realtime Convex memperbarui cache TanStack Query
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient, convexQueryClient },
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
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  });

  // Browser: ConvexReactClient memakai JWT pendek dari server (cookie sesi tetap httpOnly).
  // Setelah login berhasil, login.tsx memasangnya lagi lewat authenticateConvex().
  if (typeof window !== "undefined") {
    convexQueryClient.convexClient.setAuth(fetchConvexJwt);
  }

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
