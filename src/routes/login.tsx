import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { Eye, EyeOff, Lock, School, User } from 'lucide-react'
import { homeFor } from '~/lib/auth'
import { meQuery, publicSettingsQuery, qk } from '~/lib/queries'
import { toast } from '~/lib/toast'
import { loginFn } from '~/server/functions'
import { ErrorAlert, TextField, vString } from '~/components/ui'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (me) throw redirect({ to: homeFor(me) })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(publicSettingsQuery),
  component: LoginPage,
})

const minLen = (label: string, min: number) => (a: { value: string }) =>
  !a.value ? `${label} wajib diisi` : a.value.length < min ? `${label} minimal ${min} karakter` : undefined

function LoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: pub } = useSuspenseQuery(publicSettingsQuery)
  const [showPw, setShowPw] = useState(false)
  const [serverError, setServerError] = useState('')

  const login = useMutation({
    mutationFn: (v: { username: string; password: string }) => loginFn({ data: v }),
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user)
      toast.success('Login berhasil')
      navigate({ to: user.must_change_password ? '/settings' : homeFor(user) })
    },
    onError: (e) => setServerError(e.message),
  })

  const form = useForm({
    defaultValues: { username: '', password: '' },
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
            <form.Field name="username" validators={vString(minLen('Username', 3))}>
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

            <form.Field name="password" validators={vString(minLen('Password', 6))}>
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

            <ErrorAlert message={serverError} />

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                  {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
                  Masuk
                </button>
              )}
            </form.Subscribe>
          </form>
        </div>
      </div>
    </div>
  )
}