/**
 * Kebijakan password kuat. Dipakai saat MEMBUAT atau MENGGANTI password
 * (guru baru, ganti password). Jangan dipakai di form login: akun lama dan
 * password awal siswa (NISN) harus tetap bisa masuk.
 *
 * Aturannya ada di satu tempat, ~/convex/rules, dan dipakai bersama oleh server
 * dan klien. File ini hanya meneruskannya agar impor lama dari "./password-policy"
 * tetap berfungsi.
 */
export {
  PASSWORD_MAX,
  PASSWORD_MIN,
  evaluatePassword,
  passwordIssues,
} from "~/convex/rules";
export type { PolicyContext, PolicyRule } from "~/convex/rules";