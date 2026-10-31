// Hanya berjalan di server. Menjembatani Start -> Convex (menggantikan gas.server.ts / Apps Script).
import { ConvexHttpClient } from "convex/browser";
import { api } from "~/convex/_generated/api";

type Route = {
  kind: "query" | "mutation";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any;
  /** true = token sesi disisipkan sebagai argumen pertama */
  auth: boolean;
  args: (a: unknown[]) => Record<string, unknown>;
};

const q = (ref: Route["ref"], args: Route["args"] = () => ({}), auth = true): Route => ({ kind: "query", ref, auth, args });
const m = (ref: Route["ref"], args: Route["args"] = () => ({}), auth = true): Route => ({ kind: "mutation", ref, auth, args });

/**
 * Nama fungsi sama dengan versi Apps Script, jadi frontend tidak berubah.
 * Argumen posisi dari frontend dipetakan ke argumen bernama milik fungsi Convex.
 */
export const ROUTES: Record<string, Route> = {
  // akun & pengaturan
  login: m(api.auth.login, ([username, password]) => ({ username, password }), false),
  logout: m(api.auth.logout),
  getMe: q(api.auth.getMe),
  changePassword: m(api.auth.changePassword, ([oldPassword, newPassword]) => ({ oldPassword, newPassword })),
  getPublicSettings: q(api.settings.getPublicSettings, () => ({}), false),
  getSettings: q(api.settings.getSettings),
  saveSettings: m(api.settings.saveSettings, ([data]) => ({ data })),

  // master data
  fetchMasterData: q(api.master.fetchMasterData, ([type]) => ({ type })),
  saveStudent: m(api.master.saveStudent, ([data]) => ({ data })),
  saveClass: m(api.master.saveClass, ([data]) => ({ data })),
  saveTeacher: m(api.master.saveTeacher, ([data]) => ({ data })),
  generateStudentAccounts: m(api.master.generateStudentAccounts),
  resetStudentAccount: m(api.master.resetStudentAccount, ([studentId]) => ({ studentId })),

  // absensi
  getAttendanceForm: q(api.attendance.getAttendanceForm, ([date, classId]) => ({ date, classId })),
  submitAttendanceBatch: m(api.attendance.submitAttendanceBatch, ([date, classId, rows]) => ({ date, classId, rows })),
  getDashboardStats: q(api.attendance.getDashboardStats),
  getReportData: q(api.attendance.getReportData, ([filters]) => ({ filters })),
  getMyAttendance: q(api.attendance.getMyAttendance, ([filters]) => ({ filters })),

  // tugas
  listAssignments: q(api.assignment.listAssignments),
  saveAssignment: m(api.assignment.saveAssignment, ([data]) => ({ data })),
  deleteAssignment: m(api.assignment.deleteAssignment, ([assignmentId]) => ({ assignmentId })),
  getAssignmentDetail: q(api.assignment.getAssignmentDetail, ([assignmentId]) => ({ assignmentId })),
  saveQuestion: m(api.assignment.saveQuestion, ([data]) => ({ data })),
  deleteQuestion: m(api.assignment.deleteQuestion, ([questionId]) => ({ questionId })),
  listSubmissions: q(api.assignment.listSubmissions, ([assignmentId]) => ({ assignmentId })),
  getSubmissionForReview: q(api.assignment.getSubmissionForReview, ([submissionId]) => ({ submissionId })),
  gradeSubmission: m(api.assignment.gradeSubmission, ([submissionId, grades]) => ({ submissionId, grades })),
  listMyTasks: q(api.assignment.listMyTasks),
  startTask: m(api.assignment.startTask, ([assignmentId]) => ({ assignmentId })),
  submitTask: m(api.assignment.submitTask, ([assignmentId, answers]) => ({ assignmentId, answers })),
  getMyResult: q(api.assignment.getMyResult, ([assignmentId]) => ({ assignmentId })),
};

const isConvexError = (e: unknown): e is { name: string; data: unknown } =>
  typeof e === "object" && e !== null && (e as { name?: string }).name === "ConvexError" && "data" in e;

export async function callConvex<T = any>(fn: string, args: unknown[] = [], token?: string): Promise<T> {
  const route = ROUTES[fn];
  if (!route) throw new Error("Fungsi tidak dikenal.");

  const url = process.env.CONVEX_URL;
  if (!url) throw new Error("Server belum dikonfigurasi (CONVEX_URL).");

  const client = new ConvexHttpClient(url);
  const payload = route.auth ? { token: token ?? "", ...route.args(args) } : route.args(args);

  let res: unknown;
  try {
    res = route.kind === "query" ? await client.query(route.ref, payload) : await client.mutation(route.ref, payload);
  } catch (e) {
    // Pesan ConvexError sengaja dibuat untuk pengguna; error lain disembunyikan di production
    if (isConvexError(e)) throw new Error(typeof e.data === "string" ? e.data : JSON.stringify(e.data));
    console.error(`[convex] ${fn} gagal:`, e);
    throw new Error(
      process.env.NODE_ENV === "production" ? "Terjadi kesalahan pada server. Coba lagi." : `Convex error: ${(e as Error).message}`,
    );
  }

  // Tugas yang ditutup otomatis karena waktu habis: perubahan sudah tersimpan, lalu dilaporkan sebagai error ke pengguna
  if (res && typeof res === "object" && (res as { closed?: boolean }).closed === true) {
    throw new Error((res as { message?: string }).message ?? "Waktu mengerjakan sudah habis.");
  }
  return res as T;
}