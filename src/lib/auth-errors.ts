/** Sesi tidak valid: habis, dicabut (mis. password diganti), atau akun dinonaktifkan. */
export const isAuthFailed = (e: unknown) =>
  e instanceof Error && e.message.includes("AUTH_FAILED");

/** Akun wajib mengganti password sebelum memakai fitur lain. */
export const isMustChangePassword = (e: unknown) =>
  e instanceof Error && e.message.includes("MUST_CHANGE_PASSWORD");
