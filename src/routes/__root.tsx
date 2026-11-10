/// <reference types="vite/client" />
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { Toaster } from "~/components/toaster";
import { getConvexJwtFn } from "~/server/functions";

import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  // SSR: query Convex di loader dijalankan lewat HTTP client di server, yang belum punya
  // identitas. Tukar cookie sesi dengan JWT pendek dan pasang ke klien itu (per permintaan).
  beforeLoad: async ({ context }) => {
    if (typeof window !== "undefined") return; // di browser, ConvexReactClient.setAuth (router.tsx)
    const jwt = await getConvexJwtFn();
    if (jwt) context.convexQueryClient.serverHttpClient?.setAuth(jwt);
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Sistem Absensi Siswa" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="p-8 text-center text-base-content/60">
      Halaman tidak ditemukan.
    </div>
  ),
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="id"
      data-theme="eduabsen"
    >
      <head>
        <HeadContent />
      </head>
      <body className="h-dvh overflow-hidden bg-base-200 text-base-content antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
