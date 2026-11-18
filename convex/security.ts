import type { Doc } from "./_generated/dataModel";

import { fail } from "./errors";
import { passwordIssue } from "./rules";

/* ---------- kripto ---------- */

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Iterasi hash lama (akun tanpa hash_iterations). JANGAN diubah: hash lama bergantung padanya. */
export const PBKDF2_LEGACY_ITERATIONS = 100_000;
/** Iterasi untuk hash baru. Boleh dinaikkan kapan saja; hash lama tetap diverifikasi dengan nilainya sendiri. */
export const PBKDF2_ITERATIONS = 100_000; // naikkan ke 600_000 pada langkah 2 (lihat urutan rilis)

export async function pbkdf2Hex(
  password: string,
  salt: string,
  iterations = PBKDF2_LEGACY_ITERATIONS,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(salt),
      iterations,
    },
    key,
    256,
  );
  return toHex(bits);
}

/** Hash baru (pbkdf2) untuk password; mencatat jumlah iterasinya. */
export async function newHash(password: string) {
  const salt = randomSalt();
  return {
    password_salt: salt,
    password_hash: await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS),
    hash_algo: "pbkdf2" as const,
    hash_iterations: PBKDF2_ITERATIONS,
  };
}

/** Cocokkan password dengan hash pbkdf2 milik pengguna, memakai iterasi yang tersimpan. */
export async function verifyPbkdf2(
  user: Pick<
    Doc<"users">,
    "password_salt" | "password_hash" | "hash_iterations"
  >,
  password: string,
) {
  const iterations = user.hash_iterations ?? PBKDF2_LEGACY_ITERATIONS;
  return safeEqual(
    await pbkdf2Hex(password, user.password_salt, iterations),
    user.password_hash,
  );
}

/** true bila hash pbkdf2 pengguna masih memakai iterasi di bawah target. */
export const needsRehash = (
  user: Pick<Doc<"users">, "hash_algo" | "hash_iterations">,
) =>
  user.hash_algo === "pbkdf2" &&
  (user.hash_iterations ?? PBKDF2_LEGACY_ITERATIONS) < PBKDF2_ITERATIONS;

export const randomSalt = () => crypto.randomUUID().replace(/-/g, "");
export const randomToken = () =>
  (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- kebijakan password kuat (sama dengan frontend: password-policy.ts) ---------- */

export function assertStrongPassword(
  pw: string,
  forbidden: (string | undefined | null)[] = [],
) {
  const issue = passwordIssue(pw, forbidden);
  if (issue) fail(issue);
}
