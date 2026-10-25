import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { api } from '~/lib/api'
import { classesQuery, qk, settingsQuery, teachersQuery } from '~/lib/queries'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { isActive } from '~/lib/types'
import type { ClassInput, ClassRow } from '~/lib/types'
import { ActiveBadge, DataTable, ErrorAlert, Modal, Pager, SearchBox, SelectField, TextField, vString } from '~/components/ui'

export const Route = createFileRoute('/_app/classes')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin']),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(classesQuery),
      context.queryClient.ensureQueryData(teachersQuery),
      context.queryClient.ensureQueryData(settingsQuery),
    ]),
  component: ClassesPage,
})

type Row = ClassRow & { homeroom_name: string }
const col = columnHelperFor<Row>()

function ClassesPage() {
  const qc = useQueryClient()
  const { data: classes } = useSuspenseQuery(classesQuery)
  const { data: teachers } = useSuspenseQuery(teachersQuery)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; cls: ClassRow | null }>({ open: false, cls: null })

  const actions = useRef({ edit: (_c: ClassRow) => {} })
  actions.current = { edit: (c) => setModal({ open: true, cls: c }) }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('class_name', { header: 'Nama Kelas', cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
        col.accessor('grade_level', { header: 'Tingkat' }),
        col.accessor('academic_year', { header: 'Tahun Ajaran' }),
        col.accessor('homeroom_name', { header: 'Wali Kelas' }),
        col.accessor((r) => (isActive(r.is_active) ? 'Aktif' : 'Nonaktif'), {
          id: 'status',
          header: 'Status',
          cell: (i) => <ActiveBadge active={i.getValue() === 'Aktif'} />,
        }),
        col.display({
          id: 'actions',
          header: 'Aksi',
          enableSorting: false,
          cell: ({ row }) => (
            <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => actions.current.edit(row.original)}>Edit</button>
          ),
        }),
      ]),
    [],
  )

  const data = useMemo<Row[]>(() => {
    const names = new Map(teachers.map((t) => [t.user_id, t.full_name]))
    const q = search.trim().toLowerCase()
    return classes
      .map((c) => ({ ...c, homeroom_name: names.get(c.homeroom_teacher) ?? '-' }))
      .filter((c) => !q || `${c.class_name} ${c.homeroom_name} ${c.academic_year}`.toLowerCase().includes(q))
  }, [classes, teachers, search])

  const table = useTable({ features, columns, data, initialState: { pagination: { pageIndex: 0, pageSize: 10 } } })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Master Data Kelas</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, cls: null })}>
          <Plus className="size-4" /> Tambah Kelas
        </button>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox value={search} onChange={(v) => { setSearch(v); table.setPageIndex(0) }} placeholder="Cari kelas..." />
        </div>
        <DataTable table={table} emptyText="Tidak ada data kelas." />
        <Pager table={table} />
      </div>

      <Modal open={modal.open} onClose={() => setModal((m) => ({ ...m, open: false }))} title={modal.cls ? 'Edit Kelas' : 'Tambah Kelas'}>
        <ClassForm
          cls={modal.cls}
          onDone={() => {
            setModal({ open: false, cls: null })
            qc.invalidateQueries({ queryKey: qk.classes })
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
    </div>
  )
}

function ClassForm({ cls, onDone, onCancel }: { cls: ClassRow | null; onDone: () => void; onCancel: () => void }) {
  const { data: teachers } = useSuspenseQuery(teachersQuery)
  const { data: settings } = useSuspenseQuery(settingsQuery)
  const activeTeachers = teachers.filter((t) => isActive(t.is_active))

  const save = useMutation({
    mutationFn: (v: ClassInput) => api.saveClass(v),
    onSuccess: (r) => {
      toast.success(r.message)
      onDone()
    },
  })

  const form = useForm({
    defaultValues: {
      class_name: cls?.class_name ?? '',
      homeroom_teacher: cls?.homeroom_teacher ?? '',
      grade_level: cls?.grade_level ?? '',
      academic_year: cls?.academic_year ?? settings.active_academic_year ?? '',
    },
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          class_id: cls?.class_id ?? '',
          class_name: value.class_name.trim(),
          grade_level: value.grade_level.trim(),
          academic_year: value.academic_year.trim(),
          homeroom_teacher: value.homeroom_teacher,
        })
        .catch(() => {})
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
      <form.Field
        name="class_name"
        validators={vString(({ value }) => (!value.trim() ? 'Nama kelas wajib diisi' : value.trim().length > 50 ? 'Maksimal 50 karakter' : undefined))}
      >
        {(f) => <TextField label="Nama Kelas" field={f} placeholder="Misal: X MIPA 1" />}
      </form.Field>

      <form.Field name="homeroom_teacher">
        {(f) => (
          <SelectField label="Wali Kelas" field={f}>
            <option disabled selected value="">-- Tanpa Wali Kelas --</option>
            {activeTeachers.map((t) => (
              <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
            ))}
          </SelectField>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="grade_level" validators={vString(({ value }) => (!value.trim() ? 'Tingkat wajib diisi' : undefined))}>
          {(f) => <TextField label="Tingkat" field={f} />}
        </form.Field>
        <form.Field
          name="academic_year"
          validators={vString(({ value }) => {
            const v = value.trim()
            if (!v) return 'Tahun ajaran wajib diisi'
            const m = /^(\d{4})\/(\d{4})$/.exec(v)
            return !m || Number(m[2]) !== Number(m[1]) + 1 ? 'Format harus 2025/2026' : undefined
          })}
        >
          {(f) => <TextField label="Tahun Ajaran" field={f} placeholder="2025/2026" />}
        </form.Field>
      </div>

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