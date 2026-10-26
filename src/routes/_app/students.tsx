import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useTable } from '@tanstack/react-table'
import { KeyRound, Plus } from 'lucide-react'
import { allowRoles } from '~/lib/auth'
import { api } from '~/lib/api'
import { classesQuery, qk, studentsQuery } from '~/lib/queries'
import { columnHelperFor, features } from '~/lib/table'
import { toast } from '~/lib/toast'
import { isActive } from '~/lib/types'
import type { Student, StudentInput } from '~/lib/types'
import { ActiveBadge, DataTable, ErrorAlert, Modal, Pager, SearchBox, SelectField, TextField, useConfirm, vString } from '~/components/ui'

export const Route = createFileRoute('/_app/students')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin']),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(studentsQuery), context.queryClient.ensureQueryData(classesQuery)]),
  component: StudentsPage,
})

const col = columnHelperFor<Student>()

function StudentsPage() {
  const qc = useQueryClient()
  const { data: students } = useSuspenseQuery(studentsQuery)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null })
  const { confirm, dialog } = useConfirm()

  const generate = useMutation({
    mutationFn: api.generateStudentAccounts,
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: (id: string) => api.resetStudentAccount(id),
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(e.message),
  })

  // Handler terbaru lewat ref agar definisi kolom tetap stabil
  const actions = useRef({ edit: (_s: Student) => {}, reset: (_s: Student) => {} })
  actions.current = {
    edit: (s) => setModal({ open: true, student: s }),
    reset: async (s) => {
      const ok = await confirm(`Buat atau reset akun ${s.full_name}?\nUsername = NIS, password = NISN. Siswa diminta menggantinya saat login.`)
      if (ok) reset.mutate(s.student_id)
    },
  }

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('nis', {
          header: 'NIS/NISN',
          cell: (i) => `${i.getValue() || '-'} / ${i.row.original.nisn || '-'}`,
        }),
        col.accessor('full_name', { header: 'Nama Lengkap', cell: (i) => <span className="font-medium">{i.getValue()}</span> }),
        col.accessor('gender', { header: 'L/P' }),
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
            <div className="whitespace-nowrap">
              <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => actions.current.edit(row.original)}>Edit</button>
              <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => actions.current.reset(row.original)}>Reset Akun</button>
            </div>
          ),
        }),
      ]),
    [],
  )

  const data = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => `${s.full_name} ${s.nis} ${s.nisn}`.toLowerCase().includes(q))
  }, [students, search])

  const table = useTable({ 
    features, 
    columns, 
    data, 
    initialState: { 
      pagination: { 
        pageIndex: 0, 
        pageSize: 10 
      } 
    } 
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Master Data Siswa</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={generate.isPending}
            onClick={async () => {
              if (await confirm('Buat akun login untuk semua siswa aktif yang belum punya akun?\nUsername = NIS, password awal = NISN.')) generate.mutate()
            }}
          >
            <KeyRound className="size-4" /> Buat Akun Siswa
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, student: null })}>
            <Plus className="size-4" /> Tambah Siswa
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <div className="border-b border-base-300 bg-base-200/60 p-4">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v)
              table.setPageIndex(0)
            }}
            placeholder="Cari nama atau NIS..."
          />
        </div>
        <DataTable table={table} emptyText="Tidak ada data siswa." />
        <Pager table={table} />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.student ? 'Edit Siswa' : 'Tambah Siswa'}
      >
        <StudentForm
          student={modal.student}
          onDone={() => {
            setModal({ open: false, student: null })
            qc.invalidateQueries({ queryKey: qk.students })
            qc.invalidateQueries({ queryKey: qk.dashboard })
          }}
          onCancel={() => setModal((m) => ({ ...m, open: false }))}
        />
      </Modal>
      {dialog}
    </div>
  )
}

function StudentForm({ student, onDone, onCancel }: { student: Student | null; onDone: () => void; onCancel: () => void }) {
  const { data: classes } = useSuspenseQuery(classesQuery)
  const activeClasses = classes.filter((c) => isActive(c.is_active))
  const isNew = !student

  const save = useMutation({
    mutationFn: (v: StudentInput) => api.saveStudent(v),
    onSuccess: (r) => {
      toast.success(r.message)
      onDone()
    },
  })

  const form = useForm({
    defaultValues: {
      nis: student?.nis ?? '',
      nisn: student?.nisn ?? '',
      full_name: student?.full_name ?? '',
      gender: student?.gender || 'L',
      class_id: '',
    },
    onSubmit: async ({ value }) => {
      const payload: StudentInput = {
        student_id: student?.student_id ?? '',
        nis: value.nis.trim(),
        nisn: value.nisn.trim(),
        full_name: value.full_name.trim(),
        gender: value.gender,
      }
      if (isNew) payload.class_id = value.class_id
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
      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="nis"
          validators={vString(({ value }) => (!value.trim() ? 'NIS wajib diisi' : value.trim().length > 20 ? 'NIS maksimal 20 karakter' : undefined))}
        >
          {(f) => <TextField label="NIS" field={f} />}
        </form.Field>
        <form.Field
          name="nisn"
          validators={vString(({ value }) => (!value.trim() ? 'NISN wajib diisi' : !/^\d{10}$/.test(value.trim()) ? 'NISN harus 10 digit angka' : undefined))}
        >
          {(f) => <TextField label="NISN" field={f} inputMode="numeric" />}
        </form.Field>
      </div>

      <form.Field
        name="full_name"
        validators={vString(({ value }) => (!value.trim() ? 'Nama lengkap wajib diisi' : value.trim().length < 3 ? 'Nama minimal 3 karakter' : undefined))}
      >
        {(f) => <TextField label="Nama Lengkap" field={f} />}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="gender">
          {(f) => (
            <SelectField label="Jenis Kelamin" field={f}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </SelectField>
          )}
        </form.Field>

        {isNew ? (
          <form.Field name="class_id" validators={vString(({ value }) => (!value ? 'Pilih kelas terlebih dahulu' : undefined))}>
            {(f) => (
              <SelectField label="Kelas" field={f}>
                <option disabled selected value="">-- Pilih Kdisabled-</option>
                {activeClasses.map((c) => (
                  <option key={c.class_id} value={c.class_id}>{c.class_name} ({c.academic_year || '-'})</option>
                ))}
              </SelectField>
            )}
          </form.Field>
        ) : null}
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