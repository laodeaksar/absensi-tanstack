// Hanya berjalan di server. Jembatan TanStack Start → Convex.
import { ConvexHttpClient } from "convex/browser";

import { api } from "~/convex/_generated/api";

type ConvexRoute = {
  kind: "query" | "mutation";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any;
  /** true = token sesi disisipkan sebagai argumen */
  auth: boolean;
  /** Argumen posisi dari frontend → argumen bernama fungsi Convex */
  mapArgs: (a: unknown[]) => Record<string, unknown>;
};

const queryRoute = (
  ref: ConvexRoute["ref"],
  mapArgs: ConvexRoute["mapArgs"] = () => ({}),
  auth = true,
): ConvexRoute => ({
  kind: "query",
  ref,
  auth,
  mapArgs,
});
const mutationRoute = (
  ref: ConvexRoute["ref"],
  mapArgs: ConvexRoute["mapArgs"] = () => ({}),
  auth = true,
): ConvexRoute => ({
  kind: "mutation",
  ref,
  auth,
  mapArgs,
});

/** Nama fungsi RPC (dipakai api.ts) → fungsi Convex dan pemetaan argumennya. */
export const CONVEX_ROUTES: Record<string, ConvexRoute> = {
  // akun & pengaturan
  login: mutationRoute(
    api.auth.login,
    ([username, password, clientIp]) => ({
      username,
      password,
      // IP klien hanya dipercaya Convex bila kunci bersama cocok (LOGIN_SHARED_SECRET di kedua sisi)
      ...(typeof clientIp === "string" &&
      clientIp &&
      process.env.LOGIN_SHARED_SECRET
        ? { clientIp, serverSecret: process.env.LOGIN_SHARED_SECRET }
        : {}),
    }),
    false,
  ),
  logout: mutationRoute(api.auth.logout),
  getMe: queryRoute(api.auth.getMe),
  changePassword: mutationRoute(
    api.auth.changePassword,
    ([oldPassword, newPassword]) => ({
      oldPassword,
      newPassword,
    }),
  ),
  getPublicSettings: queryRoute(
    api.settings.getPublicSettings,
    () => ({}),
    false,
  ),
  getSettings: queryRoute(api.settings.getSettings),
  saveSettings: mutationRoute(api.settings.saveSettings, ([data]) => ({
    data,
  })),

  // master data
  fetchMasterData: queryRoute(api.master.fetchMasterData, ([type]) => ({
    type,
  })),
  saveStudent: mutationRoute(api.master.saveStudent, ([data]) => ({ data })),
  moveStudent: mutationRoute(
    api.master.moveStudent,
    ([studentId, classId]) => ({
      studentId,
      classId,
    }),
  ),
  listStudentClasses: queryRoute(api.master.listStudentClasses),
  saveClass: mutationRoute(api.master.saveClass, ([data]) => ({ data })),
  saveTeacher: mutationRoute(api.master.saveTeacher, ([data]) => ({ data })),
  generateStudentAccounts: mutationRoute(api.master.generateStudentAccounts),
  resetStudentAccount: mutationRoute(
    api.master.resetStudentAccount,
    ([studentId]) => ({
      studentId,
    }),
  ),

  // absensi
  getAttendanceForm: queryRoute(
    api.attendance.getAttendanceForm,
    ([date, classId]) => ({
      date,
      classId,
    }),
  ),
  submitAttendanceBatch: mutationRoute(
    api.attendance.submitAttendanceBatch,
    ([date, classId, rows]) => ({
      date,
      classId,
      rows,
    }),
  ),
  getDashboardStats: queryRoute(api.attendance.getDashboardStats),
  getReportData: queryRoute(api.attendance.getReportData, ([filters]) => ({
    filters,
  })),
  getMyAttendance: queryRoute(api.attendance.getMyAttendance, ([filters]) => ({
    filters,
  })),

  // tugas
  listAssignments: queryRoute(api.assignment.listAssignments),
  saveAssignment: mutationRoute(api.assignment.saveAssignment, ([data]) => ({
    data,
  })),
  deleteAssignment: mutationRoute(
    api.assignment.deleteAssignment,
    ([assignmentId]) => ({
      assignmentId,
    }),
  ),
  getAssignmentDetail: queryRoute(
    api.assignment.getAssignmentDetail,
    ([assignmentId]) => ({
      assignmentId,
    }),
  ),
  setAssignmentPublished: mutationRoute(
    api.assignment.setAssignmentPublished,
    ([assignmentId, published]) => ({
      assignmentId,
      published,
    }),
  ),
  saveQuestion: mutationRoute(api.assignment.saveQuestion, ([data]) => ({
    data,
  })),
  deleteQuestion: mutationRoute(
    api.assignment.deleteQuestion,
    ([questionId]) => ({ questionId }),
  ),
  listSubmissions: queryRoute(
    api.assignment.listSubmissions,
    ([assignmentId]) => ({
      assignmentId,
    }),
  ),
  getSubmissionForReview: queryRoute(
    api.assignment.getSubmissionForReview,
    ([submissionId]) => ({
      submissionId,
    }),
  ),
  gradeSubmission: mutationRoute(
    api.assignment.gradeSubmission,
    ([submissionId, grades]) => ({
      submissionId,
      grades,
    }),
  ),
  listMyTasks: queryRoute(api.assignment.listMyTasks),
  startTask: mutationRoute(api.assignment.startTask, ([assignmentId]) => ({
    assignmentId,
  })),
  submitTask: mutationRoute(
    api.assignment.submitTask,
    ([assignmentId, answers]) => ({
      assignmentId,
      answers,
    }),
  ),
  saveDraft: mutationRoute(
    api.assignment.saveDraft,
    ([assignmentId, answers]) => ({
      assignmentId,
      answers,
    }),
  ),
  getMyResult: queryRoute(api.assignment.getMyResult, ([assignmentId]) => ({
    assignmentId,
  })),
};

export type RouteName = keyof typeof CONVEX_ROUTES;

/** Route yang punya server function sendiri, jadi tidak boleh lewat rpcFn. */
const DEDICATED = [
  "login",
  "logout",
  "getMe",
  "getPublicSettings",
] as const satisfies readonly RouteName[];

export type RpcName = Exclude<RouteName, (typeof DEDICATED)[number]>;

export const isRpcName = (v: unknown): v is RpcName =>
  typeof v === "string" &&
  Object.hasOwn(CONVEX_ROUTES, v) &&
  !(DEDICATED as readonly string[]).includes(v);

const isConvexError = (e: unknown): e is { name: string; data: unknown } =>
  typeof e === "object" &&
  e !== null &&
  (e as { name?: string }).name === "ConvexError" &&
  "data" in e;

export async function callConvex<T = any>(
  fn: RouteName,
  args: unknown[] = [],
  token?: string,
): Promise<T> {
  const route: ConvexRoute | undefined = CONVEX_ROUTES[fn];
  if (!route) throw new Error("Fungsi tidak dikenal.");

  const url = process.env.CONVEX_URL;
  if (!url) throw new Error("Server belum dikonfigurasi (CONVEX_URL).");

  const client = new ConvexHttpClient(url);
  const payload = route.auth
    ? {
        token: token ?? "",
        ...route.mapArgs(args),
      }
    : route.mapArgs(args);

  let res: unknown;
  try {
    res =
      route.kind === "query"
        ? await client.query(route.ref, payload)
        : await client.mutation(route.ref, payload);
  } catch (e) {
    // Pesan ConvexError sengaja dibuat untuk pengguna; error lain disembunyikan di production
    if (isConvexError(e))
      throw new Error(
        typeof e.data === "string" ? e.data : JSON.stringify(e.data),
      );
    console.error(`[convex] ${fn} gagal:`, e);
    throw new Error(
      process.env.NODE_ENV === "production"
        ? "Terjadi kesalahan pada server. Coba lagi."
        : `Convex error: ${(e as Error).message}`,
    );
  }

  // Tugas yang ditutup otomatis karena waktu habis: perubahan sudah tersimpan, lalu dilaporkan sebagai error ke pengguna
  if (
    res &&
    typeof res === "object" &&
    (res as { closed?: boolean }).closed === true
  ) {
    throw new Error(
      (res as { message?: string }).message ?? "Waktu mengerjakan sudah habis.",
    );
  }
  return res as T;
}