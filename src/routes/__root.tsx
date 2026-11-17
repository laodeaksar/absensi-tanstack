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

import appCss from "~/styles.css?url";
import { OfflineBanner } from "~/components/ui/offline-banner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
      },
      { title: "EduAbsen - Sistem Presensi & Akademik" },
      {
        name: "description",
        content:
          "Sistem Manajemen Kehadiran Siswa, Tugas CBT, dan Rekapitulasi Nilai Akademik Terintegrasi.",
      },
      {
        name: "theme-color",
        content: "#4f46e5",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#1a1625",
        media: "(prefers-color-scheme: dark)",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "EduAbsen" },
      { name: "application-name", content: "EduAbsen" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap",
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
  // Script ini berjalan sinkron sebelum paint pertama untuk mencegah flash tema yang salah.
  // dangerouslySetInnerHTML dipakai karena ini adalah script blocking kecil yang sengaja diinline.
  const themeScript = `(function(){
    var s=localStorage.getItem('eduabsen_theme')||'system';
    var dark=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.setAttribute('data-theme',dark?'eduabsen-dark':'eduabsen');
  })();`;

  return (
    <html lang="id">
      <head>
        {/* Terapkan tema tersimpan sebelum paint pertama untuk mencegah FOWT */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional blocking inline script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="h-dvh overflow-hidden bg-base-200 text-base-content antialiased">
      <OfflineBanner />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
