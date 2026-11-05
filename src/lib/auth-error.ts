import type { QueryClient } from "@tanstack/react-query";

/** Sesi tidak valid: habis, dicabut (mis. password diganti), atau akun dinonaktifkan. */
export const isAuthFailed = (e: unknown) =>
  e instanceof Error && e.message.includes("AUTH_FAILED");

/** Akun wajib mengganti password sebelum memakai fitur lain. */
export const isMustChangePassword = (e: unknown) =>
  e instanceof Error && e.message.includes("MUST_CHANGE_PASSWORD");

let redirecting = false;

/**
 * Penangan terpusat untuk error sesi dari query dan mutation mana pun.
 * Pasang di `onError` milik QueryCache dan MutationCache pada QueryClient, mis.:
 *
 *   const queryClient: QueryClient = new QueryClient({
 *     queryCache: new QueryCache({ onError: (e) => handleAuthError(e, queryClient) }),
 *     mutationCache: new MutationCache({ onError: (e) => handleAuthError(e, queryClient) }),
 *     // ...defaultOptions yang sudah ada
 *   });
 *
 * Memakai pindah halaman penuh (bukan router) agar seluruh state ikut bersih.
 */
export function handleAuthError(error: unknown, client: QueryClient) {
  if (typeof window === "undefined") return; // SSR: tidak ada yang bisa dialihkan
  const path = window.location.pathname;

  if (isAuthFailed(error)) {
    if (redirecting || path === "/login") return;
    redirecting = true;
    client.clear();
    window.location.assign("/login");
    return;
  }
  if (isMustChangePassword(error) && path !== "/settings") {
    window.location.assign("/settings");
  }
}
