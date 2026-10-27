import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm, revalidateLogic } from '@tanstack/react-form'
import { Eye, EyeOff, Lock, School, User } from 'lucide-react'
import { homeFor } from '~/lib/auth'
import { LOCK_MINUTES, isLockMessage, loginSchema } from '~/lib/login-schema'
import { meQuery, publicSettingsQuery, qk } from '~/lib/queries'
import { toast } from '~/lib/toast'
import { loginFn } from '~/server/functions'
import { ErrorAlert, TextField } from '~/components/ui'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (me) throw redirect({ to: homeFor(me) })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSettingsQuery),
  component: LoginPage,
})

/** Sisa detik sampai `until` (epoch ms); berhenti sendiri saat selesai. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    setNow(Date.now())
    const id = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= until) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function LoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: pub } = useSuspenseQuery(publicSettingsQuery)
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState('')
  // Perkiraan waktu buka kunci dari server (dihitung sejak pesan kunci diterima)
  const [lockedUntil, setLockedUntil] = useState(0)
  const lockLeft = useCountdown(lockedUntil)
  const locked = lockLeft > 0

  const login = useMutation({
    mutationFn: (v: { username: string; password: string }) => loginFn({ data: v }),
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user)
      toast.success('Login berhasil')
      navigate({ to: user.must_change_password ? '/settings' : homeFor(user) })
    },
    onError: (e) => {
      setServerError(e.message)
      if (isLockMessage(e.message)) setLockedUntil(Date.now() + LOCK_MINUTES * 60_000)
    },
  })

  const form = useForm({
    defaultValues: { username: '', password: '' },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: loginSchema },
      //onChange: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setServerError('')
      await login.mutateAsync({ username: value.username.trim(), password: value.password }).catch(() => {})
    },
  })

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-base-200 p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body p-8">
          <div className="mb-4 text-center">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <School className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">{pub.school_name}</h1>
            <p className="mt-1 text-sm text-base-content/60">Sistem Manajemen Kehadiran Siswa</p>
          </div>

          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
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
                <TextField
                  label="Password"
                  field={field}
                  type={showPw ? 'text' : 'password'}
                  icon={<Lock className="size-4 opacity-50" />}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="btn btn-circle btn-ghost btn-xs"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
              )}
            </form.Field>

            <ErrorAlert message={locked ? `${serverError} Coba lagi sekitar ${mmss(lockLeft)}.` : serverError} />

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting || locked}>
                  {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
                  {locked ? `Terkunci (${mmss(lockLeft)})` : 'Masuk'}
                </button>
              )}
            </form.Subscribe>
          </form>
        </div>
      </div>
    </div>
  )
}