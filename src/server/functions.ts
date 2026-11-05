import { createMiddleware, createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";

import type { SessionUser } from "~/lib/types";

import type { RpcName } from "./convex.server";

import { callConvex, isRpcName } from "./convex.server";

const SESSION_COOKIE = "eduabsen_token"; // nilai tetap agar sesi berjalan tidak putus
const SESSION_MAX_AGE_S = 60 * 60 * 6;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  };
}

export type { RpcName }; // agar api.ts tetap mengimpor dari '~/server/functions'

const authMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const token = getCookie(SESSION_COOKIE);
  if (!token) throw new Error("AUTH_FAILED");
  return next({ context: { token } });
});

/** RPC generik untuk semua endpoint yang butuh login (ke Convex). Token tidak pernah sampai ke browser. */
export const rpcFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(
    z.object({
      fn: z.custom<RpcName>(isRpcName, "Fungsi tidak dikenal"),
      args: z.array(z.unknown()),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const res = await callConvex<any>(data.fn, data.args, context.token);
      // Setelah ganti password, semua sesi dibatalkan di backend
      if (data.fn === "changePassword")
        deleteCookie(SESSION_COOKIE, {
          path: "/",
        });
      return res;
    } catch (e) {
      if (e instanceof Error && e.message.includes("AUTH_FAILED")) {
        deleteCookie(SESSION_COOKIE, {
          path: "/",
        });
      }
      throw e;
    }
  });

export const loginFn = createServerFn({
  method: "POST",
})
  .validator(
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const res = await callConvex<{
      ok: boolean;
      token?: string;
      user?: SessionUser;
      message?: string;
      retry_after_ms?: number;
    }>("login", [data.username, data.password]);
    if (!res.ok || !res.token || !res.user) {
      return {
        ok: false as const,
        message: res.message || "Login gagal.",
        retry_after_ms: res.retry_after_ms ?? 0,
      };
    }
    setCookie(SESSION_COOKIE, res.token, sessionCookieOptions());
    return {
      ok: true as const,
      user: res.user,
    };
  });

export const logoutFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    try {
      await callConvex("logout", [], token);
    } catch {
      /* abaikan: cookie tetap dihapus */
    }
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

/** Sesi aktif (atau null). Dipakai guard route. */
export const getMeFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<SessionUser | null> => {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  try {
    const res = await callConvex<{
      user: SessionUser;
    }>("getMe", [], token);
    return res.user;
  } catch (e) {
    if (e instanceof Error && e.message.includes("AUTH_FAILED")) {
      deleteCookie(SESSION_COOKIE, {
        path: "/",
      });
      return null;
    }
    throw e;
  }
});

export const getPublicSettingsFn = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    const res = await callConvex<{
      settings: { school_name: string };
    }>("getPublicSettings");
    return res.settings;
  } catch {
    return { school_name: "EduAbsen" };
  }
});
