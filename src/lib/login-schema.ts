import { z } from "zod";

import { LIMITS } from "~/convex/limits";

/**
 * Aturan login. Dibuat longgar secara sengaja: username siswa = NIS (format bebas),
 * jadi hanya cek panjang dan spasi. Pencocokan kredensial tetap di server.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username wajib diisi")
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^\S+$/, "Username tidak boleh mengandung spasi"),
  // Password tidak di-trim: spasi di awal/akhir bisa jadi bagian password
  password: z
    .string()
    .min(1, "Password wajib diisi")
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password maksimal 100 karakter"),
});

/** Server mengunci username setelah 5 kali gagal (lihat login di convex/auth.ts); lama kunci dari LIMITS. */
export const LOCK_MINUTES = LIMITS.loginLockMs / 60_000;
export const isLockMessage = (msg: string) =>
  /terlalu banyak percobaan/i.test(msg);
