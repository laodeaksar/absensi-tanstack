import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { qk, settingsQuery } from '~/lib/queries'
import { api } from '~/lib/api'
import { toast } from '~/lib/toast'
import { ErrorAlert, TextField, vString } from '~/components/ui'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

const ROLE_LABEL = { admin: 'Administrator', guru: 'Guru', siswa: 'Siswa' } as const

function SettingsPage() {
  const { me } = Route.useRouteContext()
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pengaturan</h2>
      {me.must_change_password ? (
        <div role="alert" className="alert alert-info alert-soft">
          Demi keamanan, ganti password bawaan Anda sekarang.
        </div>
      ) : null}
      {me.role === 'admin' ? <SchoolSettings /> : null}
      <PasswordCard />
    </div>
  )
}

const yearCheck = (value: string) => {
  const v = value.trim()
  if (!v) return undefined
  const m = /^(\d{4})\/(\d{4})$/.exec(v)
  return !m || Number(m[2]) !== Number(m[1]) + 1 ? 'Format harus 2025/2026' : undefined
}

function SchoolSettings() {
  const qc = useQueryClient()
  const { data: s } = useSuspenseQuery(settingsQuery)

  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (r) => {
      toast.success(r.message || 'Pengaturan tersimpan')
      qc.invalidateQueries({ queryKey: qk.settings })
    },
  })

  const form = useForm({
    defaultValues: {
      school_name: s.school_name ?? '',
      school_address: s.school_address ?? '',
      principal_name: s.principal_name ?? '',
      principal_nip: s.principal_nip ?? '',
      active_academic_year: s.active_academic_year ?? '',
      edit_window_days: s.edit_window_days ?? '0',
    },
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          school_name: value.school_name.trim(),
          school_address: value.school_address.trim(),
          principal_name: value.principal_name.trim(),
          principal_nip: value.principal_nip.trim(),
          active_academic_year: value.active_academic_year.trim(),
          edit_window_days: value.edit_window_days.trim() || '0',
        })
        .catch(() => {})
    },
  })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body max-w-2xl">
          <h3 className="card-title text-base">Data Sekolah</h3>
          <p className="text-sm text-base-content/60">Dipakai pada judul aplikasi dan kop laporan cetak.</p>
          <form.Field
            name="school_name"
            validators={vString(({ value }) => (!value.trim() ? 'Nama sekolah wajib diisi' : value.trim().length > 100 ? 'Maksimal 100 karakter' : undefined))}
          >
            {(f) => <TextField label="Nama Sekolah" field={f} maxLength={100} />}
          </form.Field>
          <form.Field name="school_address" validators={vString(({ value }) => (value.length > 200 ? 'Maksimal 200 karakter' : undefined))}>
            {(f) => <TextField label="Alamat Sekolah" field={f} maxLength={200} />}
          </form.Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="principal_name" validators={vString(({ value }) => (value.length > 100 ? 'Maksimal 100 karakter' : undefined))}>
              {(f) => <TextField label="Nama Kepala Sekolah" field={f} maxLength={100} />}
            </form.Field>
            <form.Field
              name="principal_nip"
              validators={vString(({ value }) => (value.trim() && !/^[0-9]{5,30}$/.test(value.trim()) ? 'NIP hanya angka (5-30 digit)' : undefined))}
            >
              {(f) => <TextField label="NIP Kepala Sekolah" field={f} inputMode="numeric" />}
            </form.Field>
          </div>
        </div>
      </div>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body">
          <h3 className="card-title text-base">Absensi</h3>
          <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="active_academic_year" validators={vString(({ value }) => yearCheck(value))}>
              {(f) => <TextField label="Tahun Ajaran Aktif" field={f} placeholder="2025/2026" hint="Terisi otomatis saat menambah kelas baru." />}
            </form.Field>
            <form.Field
              name="edit_window_days"
              validators={vString(({ value }) => {
                const v = value.trim()
                return v && (!/^\d{1,3}$/.test(v) || Number(v) > 365) ? 'Isi angka 0 sampai 365' : undefined
              })}
            >
              {(f) => <TextField label="Batas Edit Absensi Guru (hari)" field={f} inputMode="numeric" hint="0 = tanpa batas. Admin tidak dibatasi." />}
            </form.Field>
          </div>
          <ErrorAlert message={save.error?.message} />
          <div className="card-actions mt-2">
            <form.Subscribe selector={(st) => st.isSubmitting}>
              {(busy) => (
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? <span className="loading loading-spinner loading-sm" /> : null}
                  Simpan Pengaturan
                </button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </div>
    </form>
  )
}

function PasswordCard() {
  const { me } = Route.useRouteContext()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const change = useMutation({
    mutationFn: (v: { oldPw: string; newPw: string }) => api.changePassword(v.oldPw, v.newPw),
    onSuccess: () => {
      toast.success('Password diubah. Silakan login kembali.')
      qc.clear()
      setTimeout(() => navigate({ to: '/login' }), 1200)
    },
  })

  const form = useForm({
    defaultValues: { old: '', next: '', confirm: '' },
    onSubmit: async ({ value }) => {
      await change.mutateAsync({ oldPw: value.old, newPw: value.next }).catch(() => {})
    },
  })

  return (
    <div className="card border border-base-300 bg-base-100">
      <form
        noValidate
        className="card-body max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <h3 className="card-title text-base">Akun Saya</h3>
        <p className="text-sm text-base-content/60">
          {me.full_name || me.username} ({me.username}) - {ROLE_LABEL[me.role] ?? me.role}
        </p>

        <form.Field name="old" validators={vString(({ value }) => (!value ? 'Password lama wajib diisi' : undefined))}>
          {(f) => <TextField label="Password Lama" field={f} type="password" autoComplete="current-password" />}
        </form.Field>

        <form.Field
          name="next"
          validators={{
            onChangeListenTo: ['old'],
            onChange: ({ value, fieldApi }) =>
              !value ? 'Password baru wajib diisi'
              : value.length < 6 ? 'Minimal 6 karakter'
              : value === fieldApi.form.getFieldValue('old') ? 'Harus berbeda dari password lama'
              : undefined,
            onSubmit: ({ value, fieldApi }) =>
              !value ? 'Password baru wajib diisi'
              : value.length < 6 ? 'Minimal 6 karakter'
              : value === fieldApi.form.getFieldValue('old') ? 'Harus berbeda dari password lama'
              : undefined,
          }}
        >
          {(f) => <TextField label="Password Baru" field={f} type="password" autoComplete="new-password" placeholder="Minimal 6 karakter" />}
        </form.Field>

        <form.Field
          name="confirm"
          validators={{
            onChangeListenTo: ['next'],
            onChange: ({ value, fieldApi }) => (value !== fieldApi.form.getFieldValue('next') ? 'Konfirmasi tidak sama dengan password baru' : undefined),
            onSubmit: ({ value, fieldApi }) => (value !== fieldApi.form.getFieldValue('next') ? 'Konfirmasi tidak sama dengan password baru' : undefined),
          }}
        >
          {(f) => <TextField label="Ulangi Password Baru" field={f} type="password" autoComplete="new-password" />}
        </form.Field>

        <ErrorAlert message={change.error?.message} />

        <div className="card-actions mt-2">
          <form.Subscribe selector={(st) => st.isSubmitting}>
            {(busy) => (
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <span className="loading loading-spinner loading-sm" /> : null}
                Ubah Password
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  )
}