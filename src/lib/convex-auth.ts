import type { ConvexReactClient } from "convex/react";

import { getConvexJwtFn } from "~/server/functions";

/** Dipanggil ConvexReactClient tiap perlu token (awal, dan sebelum JWT kedaluwarsa). */
export const fetchConvexJwt = async () => {
  try {
    return await getConvexJwtFn();
  } catch {
    return null;
  }
};

/**
 * Pasang ulang auth (mis. setelah login) dan tunggu sampai server Convex mengonfirmasi,
 * supaya query realtime tidak berlangganan sebagai tamu. Tidak pernah menolak:
 * batas waktu `timeoutMs` agar login tidak tertahan.
 */
export function authenticateConvex(
  client: ConvexReactClient,
  timeoutMs = 5000,
) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    client.setAuth(fetchConvexJwt, (isAuthenticated) => {
      if (!isAuthenticated) return;
      clearTimeout(timer);
      resolve();
    });
  });
}
