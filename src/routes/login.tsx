import { useForm, revalidateLogic } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Lock, School, User } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorAlert, TextField, PasswordField } from "~/components/ui";
import { homeFor } from "~/lib/auth";
import { isLockMessage, loginSchema } from "~/lib/login-schema";
import { meQuery, publicSettingsQuery, qk } from "~/lib/queries";
import { toast } from "~/lib/toast";
import { loginFn } from "~/server/functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me) throw redirect({ to: homeFor(me) });
  },
  loader: ({ context }) => context.queryClient.query(publicSettingsQuery),
  component: LoginPage,
});

/** Kegagalan login. `retryAfterMs` > 0 berarti akun terkunci; nilainya dihitung server (bebas dari selisih jam perangkat). */
class LoginError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Sisa detik sampai `until` (epoch ms); berhenti sendiri saat selesai. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Segarkan `now` dulu: nilai lama (mis. sejak halaman dibuka) membuat hitungan mundur terlalu besar sesaat
    setNow(Date.now());
    if (until <= Date.now()) return;

    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pub } = useSuspenseQuery(publicSettingsQuery);
  const [serverError, setServerError] = useState("");
  // Perkiraan waktu buka kunci dari server (dihitung sejak pesan kunci diterima)
  const [lockedUntil, setLockedUntil] = useState(0);
  const lockLeft = useCountdown(lockedUntil);
  const locked = lockLeft > 0;

  // Kunci berakhir: hapus pesan "terlalu banyak percobaan" supaya tidak menggantung
  useEffect(() => {
    if (lockedUntil > 0 && lockLeft === 0) {
      setLockedUntil(0);
      setServerError((m) => (isLockMessage(m) ? "" : m));
    }
  }, [lockedUntil, lockLeft]);

  const login = useMutation({
    mutationFn: async (v: { username: string; password: string }) => {
      const r = await loginFn({ data: v });
      if (!r.ok) throw new LoginError(r.message, r.retry_after_ms);
      return r.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user);
      toast.success("Login berhasil");
      navigate({
        to: user.must_change_password ? "/settings" : homeFor(user),
      });
    },
    onError: (e) => {
      setServerError(e.message);
      if (e instanceof LoginError && e.retryAfterMs > 0)
        setLockedUntil(Date.now() + e.retryAfterMs);
    },
  });

  const form = useForm({
    defaultValues: { username: "", password: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: loginSchema },
    onSubmit: async ({ value }) => {
      setServerError("");
      await login
        .mutateAsync({
          username: value.username.trim(),
          password: value.password,
        })
        .catch(() => {});
    },
  });

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-base-200 p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body p-8">
          <div className="mb-4 text-center">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <School className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">{pub.school_name}</h1>
            <p className="mt-1 text-sm text-base-content/60">
              Sistem Manajemen Kehadiran Siswa
            </p>
          </div>

          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="username">
              {(field) => (
                <TextField
                  label="Username"
                  field={field}
                  icon={<User className="size-4 opacity-50" />}
                  autoComplete="username"
                  placeholder="Masukkan (siswa: NIS)"
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <PasswordField
                  label="Password"
                  field={field}
                  icon={<Lock className="size-4 opacity-50" />}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                />
              )}
            </form.Field>

            <ErrorAlert
              message={
                locked
                  ? `${serverError} Coba lagi sekitar ${mmss(lockLeft)}.`
                  : serverError
              }
            />

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting || locked}
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  {locked ? `Terkunci (${mmss(lockLeft)})` : "Masuk"}
                </button>
              )}
            </form.Subscribe>
          </form>
        </div>
      </div>
    </div>
  );
}
