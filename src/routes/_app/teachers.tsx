import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { api } from '~/lib/api'
import { classesQuery, qk, teachersQuery } from '~/lib/queries'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { isActive, parseClassIds } from '~/lib/types'
import type { Teacher, TeacherInput } from '~/lib/types'
import { ActiveBadge, DataTable, ErrorAlert, Modal, Pager, SearchBox, TextField, vString } from '~/components/ui'

export const Route = createFileRoute('/_app/teachers')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin']),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(teachersQuery), context.queryClient.ensureQueryData(classesQuery)]),
  component: TeachersPage,
})

type Row = Teacher & { class_names: string[]; active: boolean }
const col = columnHelperFor<Row>()

function TeachersPage() {
  const qc = useQueryClient()
  const { data: teachers } = useSuspenseQuery(teachersQuery)
  const { data: classes } = useSuspenseQuery(classesQuery)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; teacher: Teacher | null }>({ open: false, teacher: null })

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; is_active: boolean }) => api.saveTeacher(v),
    onSuccess: (_r, v) => {
      toast.success(v.is_active ? 'Akun guru diaktifkan' : 'Akun guru dinonaktifkan')
      qc.invalidateQueries({ queryKey: qk.teachers })
    },
    onError: (e) => toast.error(e.message),
  })

  const actions = useRef({ edit: (_t: Teacher) => {}, toggle: (_t: Row) => {} })
  actions.current = {
    edit: (t) => setModal({ open: true, teacher: t }),
    toggle: (t) => toggle.mutate({ user_id: t.user_id, is_active: !t.active }),
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('full_name', {
          header: 'Nama Lengkap',
          cell: (i) => (
            <>
              <div className="font-medium">{i.getValue()}</div>
              {i.row.original.nip ? <div className="text-xs text-base-content/60">NIP {i.row.original.nip}</div> : null}
            </>
          ),
        }),
        col.accessor('username', { header: 'Username' }),
        col.display({
          id: 'contact',
          header: 'Kontak',
          enableSorting: false,
          cell: ({ row }) => {
            const t = row.original
            if (!t.phone && !t.email) return <span className="text-base-content/40">-</span>
            return (
              <>
                {t.phone ? <div>{t.phone}</div> : null}
                {t.email ? <div className="text-xs text-base-content/60">{t.email}</div> : null}
              </>
            )
          },
        }),
        col.display({
          id: 'classes',
          header: 'Kelas Diampu',
          enableSorting: false,
          cell: ({ row }) =>
            row.original.class_names.length ? (
              <div className="flex flex-wrap gap-1">
                {row.original.class_names.map((n) => (
                  <span key={n} className="badge badge-ghost badge-sm">{n}</span>
                ))}
              </div>
            ) : (
              <span className="text-base-content/40">-</span>
            ),
        }),
        col.accessor((r) => (r.active ? 'Aktif' : 'Nonaktif'), {
          id: 'status',
          header: 'Status',
          cell: (i) => <ActiveBadge active={i.getValue() === 'Aktif'} />,
        }),
        col.display({
          id: 'actions',
          header: 'Aksi',
          enableSorting: false,
          cell: ({ row }) => (
            <div className="whitespace-nowrap">
              <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => actions.current.edit(row.original)}>Edit</button>
              <button
                type="button"
                className={`btn btn-ghost btn-xs ${row.original.active ? 'text-error' : 'text-success'}`}
                onClick={() => actions.current.toggle(row.original)}
              >
                {row.original.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          ),
        }),
      ]),
    [],
  )

  const data = useMemo<Row[]>(() => {
    const names = new Map(classes.map((c) => [c.class_id, c.class_name]))
    const q = search.trim().toLowerCase()
    return teachers
      .map((t) => ({
        ...t,
        active: isActive(t.is_active),
        class_names: parseClassIds(t.assigned_classes).map((id) => names.get(id)).filter((n): n is string => !!n),
      }))
      .filter((t) => !q || `${t.full_name} ${t.username} ${t.nip}`.toLowerCase().includes(q))
  }, [teachers, classes, search])

  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 10 } } })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Manajemen Guru</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, teacher: null })}>
          <Plus className="size-4" /> Tambah Guru
        </button>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox value={search} onChange={(v) => { setSearch(v); table.setPageIndex(0) }} placeholder="Cari nama atau username..." />
        </div>
        <DataTable table={table} emptyText="Belum ada data guru." />
        <Pager table={table} />
      </div>

      <Modal open={modal.open} onClose={() => setModal((m) => ({ ...m, open: false }))} title={modal.teacher ? 'Edit Guru' : 'Tambah Guru'}>
        <TeacherForm
          teacher={modal.teacher}
          onDone={() => {
            setModal({ open: false, teacher: null })
            qc.invalidateQueries({ queryKey: qk.teachers })
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
    </div>
  )
}

function TeacherForm({ teacher, onDone, onCancel }: { teacher: Teacher | null; onDone: () => void; onCancel: () => void }) {
  const { data: classes } = useSuspenseQuery(classesQuery)
  const isNew = !teacher
  const assigned = teacher ? parseClassIds(teacher.assigned_classes) : []
  const visibleClasses = classes.filter((c) => isActive(c.is_active) || assigned.includes(c.class_id))

  const save = useMutation({
    mutationFn: (v: TeacherInput) => api.saveTeacher(v),
    onSuccess: (r) => {
      toast.success(r.message || 'Data guru tersimpan')
      onDone()
    },
  })

  const form = useForm({
    defaultValues: {
      full_name: teacher?.full_name ?? '',
      nip: teacher?.nip ?? '',
      phone: teacher?.phone ?? '',
      email: teacher?.email ?? '',
      username: teacher?.username ?? '',
      password: '',
      assigned_classes: assigned,
      is_active: teacher ? isActive(teacher.is_active) : true,
    },
    onSubmit: async ({ value }) => {
      const payload: TeacherInput = {
        user_id: teacher?.user_id ?? '',
        full_name: value.full_name.trim(),
        nip: value.nip.trim(),
        phone: value.phone.trim(),
        email: value.email.trim(),
        username: value.username.trim(),
        assigned_classes: value.assigned_classes,
        is_active: value.is_active,
      }
      if (value.password) payload.password = value.password
      await save.mutateAsync(payload).catch(() => {})
    },
  })

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field name="full_name" validators={vString(({ value }) => (!value.trim() ? 'Nama lengkap wajib diisi' : undefined))}>
        {(f) => <TextField label="Nama Lengkap" field={f} />}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="nip" validators={vString(({ value }) => (value.trim() && !/^[0-9]{5,30}$/.test(value.trim()) ? 'NIP hanya angka (5-30 digit)' : undefined))}>
          {(f) => <TextField label="NIP" field={f} inputMode="numeric" />}
        </form.Field>
        <form.Field name="phone" validators={vString(({ value }) => (value.trim() && !/^[0-9+][0-9\s-]{5,19}$/.test(value.trim()) ? 'Nomor HP tidak valid' : undefined))}>
          {(f) => <TextField label="No. HP" field={f} inputMode="tel" />}
        </form.Field>
      </div>

      <form.Field name="email" validators={vString(({ value }) => (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? 'Format email tidak valid' : undefined))}>
        {(f) => <TextField label="Email" field={f} type="email" />}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="username"
          validators={vString(({ value }) =>
            !value.trim() ? 'Username wajib diisi'
            : !/^[A-Za-z0-9._-]{3,30}$/.test(value.trim()) ? '3-30 karakter: huruf, angka, titik, garis bawah, atau strip'
            : undefined)}
        >
          {(f) => <TextField label="Username" field={f} autoComplete="off" />}
        </form.Field>
        <form.Field
          name="password"
          validators={vString(({ value }) =>
            isNew && !value ? 'Password wajib diisi untuk guru baru'
            : value && value.length < 6 ? 'Password minimal 6 karakter'
            : undefined)}
        >
          {(f) => (
            <TextField
              label="Password"
              field={f}
              type="password"
              autoComplete="new-password"
              placeholder={isNew ? 'Minimal 6 karakter' : 'Kosongkan jika tidak diubah'}
            />
          )}
        </form.Field>
      </div>

      <form.Field name="assigned_classes">
        {(f) => (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Kelas yang Diampu</legend>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-box border border-base-300 p-3">
              {visibleClasses.length === 0 ? (
                <p className="text-sm text-base-content/60">Belum ada kelas aktif.</p>
              ) : (
                visibleClasses.map((c) => {
                  const checked = f.state.value.includes(c.class_id)
                  return (
                    <label key={c.class_id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={checked}
                        onChange={() =>
                          f.handleChange(checked ? f.state.value.filter((id) => id !== c.class_id) : [...f.state.value, c.class_id])
                        }
                      />
                      <span>
                        {c.class_name} <span className="text-base-content/40">({c.academic_year || '-'})</span>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </fieldset>
        )}
      </form.Field>

      <form.Field name="is_active">
        {(f) => (
          <label className="flex cursor-pointer items-center gap-2 pt-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={f.state.value} onChange={(e) => f.handleChange(e.target.checked)} />
            <span>Akun aktif (dapat login)</span>
          </label>
        )}
      </form.Field>

      <ErrorAlert message={save.error?.message} />

      <div className="modal-action">
        <button type="button" className="btn" onClick={onCancel}>Batal</button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : null}
              Simpan
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}