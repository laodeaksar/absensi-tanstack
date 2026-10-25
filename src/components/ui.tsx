import { useCallback, useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
// import type { InputHTMLAttributes, ReactNode } from 'react'
import { FlexRender } from '@tanstack/react-table'
import type { Table } from '@tanstack/react-table'
import type { AnyFieldApi } from '@tanstack/react-form'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, CircleAlert, Search, X } from 'lucide-react'
import type { AppFeatures } from '~/lib/table'

/* ---------- umum ---------- */

export function PageSpinner() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge badge-soft badge-sm ${active ? 'badge-success' : 'badge-error'}`}>
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const cl =
    status === 'Hadir' ? 'badge-success'
    : status === 'Alpa' ? 'badge-error'
    : status === 'Izin' ? 'badge-info'
    : status === 'Sakit' ? 'badge-warning'
    : 'badge-ghost'
  return <span className={`badge badge-soft badge-sm ${cl}`}>{status || '-'}</span>
}

export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="alert alert-error alert-soft text-sm">
      <CircleAlert className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="input input-sm w-full max-w-xs">
      <Search className="size-4 opacity-50" />
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/* ---------- modal & konfirmasi ---------- */

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} className="modal modal-bottom sm:modal-middle no-print" onClose={onClose}>
      <div className="modal-box w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="btn btn-circle btn-ghost btn-sm" aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
        {/* Anak dipasang hanya saat terbuka agar form selalu mulai dari nilai awal */}
        {open ? children : null}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>Tutup</button>
      </form>
    </dialog>
  )
}

export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback(
    (message: string) => new Promise<boolean>((resolve) => setState({ message, resolve })),
    [],
  )
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }

  const dialog = (
    <dialog
      ref={(el) => {
        if (!el) return
        if (state && !el.open) el.showModal()
        if (!state && el.open) el.close()
      }}
      className="modal modal-bottom sm:modal-middle no-print"
      onClose={() => state && close(false)}
    >
      <div className="modal-box">
        <h3 className="text-lg font-bold">Konfirmasi</h3>
        <p className="whitespace-pre-line py-4">{state?.message}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => close(false)}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={() => close(true)}>Lanjutkan</button>
        </div>
      </div>
    </dialog>
  )
  return { confirm, dialog }
}

/* ---------- field TanStack Form ---------- 

const errorText = (field: AnyFieldApi): string => {
  if (!field.state.meta.isTouched) return ''
  const first = field.state.meta.errors.find(Boolean) as unknown
  if (!first) return ''
  return typeof first === 'string' ? first : ((first as { message?: string }).message ?? '')
}

export const hasError = (field: AnyFieldApi) => !!errorText(field)

** Validator yang sama dipakai saat mengetik dan saat submit. *
export const vString = (fn: (a: { value: string }) => string | undefined) => ({ onChange: fn, onSubmit: fn })

export function FieldShell({ label, field, hint, children }: { label: string; field: AnyFieldApi; hint?: string; children: ReactNode }) {
  const msg = errorText(field)
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      {children}
      {hint && !msg ? <p className="label">{hint}</p> : null}
      {msg ? (
        <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
          <CircleAlert className="size-3.5 shrink-0" />
          <span>{msg}</span>
        </p>
      ) : null}
    </fieldset>
  )
}

type InputExtra = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function TextField({
  label, field, hint, icon, trailing, ...rest
}: { label: string; field: AnyFieldApi; hint?: string; icon?: ReactNode; trailing?: ReactNode } & InputExtra) {
  const err = hasError(field)
  const input = (
    <input
      {...rest}
      id={field.name}
      name={field.name}
      value={field.state.value ?? ''}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={err}
      className={icon || trailing ? 'grow' : `input w-full ${err ? 'input-error' : ''}`}
    />
  )
  return (
    <FieldShell label={label} field={field} hint={hint}>
      {icon || trailing ? (
        <label className={`input w-full ${err ? 'input-error' : ''}`}>
          {icon}
          {input}
          {trailing}
        </label>
      ) : (
        input
      )}
    </FieldShell>
  )
}

export function SelectField({ label, field, hint, children }: { label: string; field: AnyFieldApi; hint?: string; children: ReactNode }) {
  const err = hasError(field)
  return (
    <FieldShell label={label} field={field} hint={hint}>
      <select
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={err}
        className={`select w-full ${err ? 'select-error' : ''}`}
      >
        {children}
      </select>
    </FieldShell>
  )
}
*/

/* ---------- field TanStack Form + validator daisyUI ---------- */

const errorText = (field: AnyFieldApi): string => {
  if (!field.state.meta.isTouched) return ''
  const first = field.state.meta.errors.find(Boolean) as unknown
  if (!first) return ''
  return typeof first === 'string' ? first : ((first as { message?: string }).message ?? '')
}

export const hasError = (field: AnyFieldApi) => !!errorText(field)

/** Validator yang sama dipakai saat mengetik dan saat submit. */
export const vString = (fn: (a: { value: string }) => string | undefined) => ({ onChange: fn, onSubmit: fn })

/** Teruskan error TanStack Form ke Constraint Validation API agar kelas `validator` daisyUI aktif. */
function useValidity<T extends HTMLInputElement | HTMLSelectElement>(message: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.setCustomValidity(message)
  }, [message])
  return ref
}

export function FieldShell({ label, hint, message, children }: { label: string; hint?: string; message: string; children: ReactNode }) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      {children}
      {/* Harus berada tepat setelah elemen .validator */}
      <p
        role={message ? 'alert' : undefined}
        className={`validator-hint ${message ? 'block! visible! text-error' : 'hidden'}`}
      >
        {message}
      </p>
      {hint && !message ? <p className="label">{hint}</p> : null}
    </fieldset>
  )
}

type InputExtra = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function TextField({
  label, field, hint, icon, trailing, ...rest
}: { label: string; field: AnyFieldApi; hint?: string; icon?: ReactNode; trailing?: ReactNode } & InputExtra) {
  const message = errorText(field)
  const ref = useValidity<HTMLInputElement>(message)
  const wrapped = !!(icon || trailing)

  const input = (
    <input
      {...rest}
      ref={ref}
      id={field.name}
      name={field.name}
      value={field.state.value ?? ''}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={!!message}
      className={wrapped ? 'grow' : `input validator w-full ${message ? 'input-error' : ''}`}
    />
  )

  return (
    <FieldShell label={label} hint={hint} message={message}>
      {wrapped ? (
        // Untuk input berikon, kelas validator dipasang di <label>
        <label className={`input validator w-full ${message ? 'input-error' : ''}`}>
          {icon}
          {input}
          {trailing}
        </label>
      ) : (
        input
      )}
    </FieldShell>
  )
}

type SelectExtra = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function SelectField({
  label, field, hint, children, ...rest
}: { label: string; field: AnyFieldApi; hint?: string; children: ReactNode } & SelectExtra) {
  const message = errorText(field)
  const ref = useValidity<HTMLSelectElement>(message)

  return (
    <FieldShell label={label} hint={hint} message={message}>
      <select
        {...rest}
        ref={ref}
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={!!message}
        className={`select validator w-full ${message ? 'select-error' : ''}`}
      >
        {children}
      </select>
    </FieldShell>
  )
}

/* ---------- TanStack Table v9 ---------- */

export function DataTable<TData extends Record<string, any>>({ table, emptyText }: { table: Table<AppFeatures, TData>; emptyText: string }) {
  const rows = table.getRowModel().rows
  const headerGroups = table.getHeaderGroups()
  const colCount = table.getAllLeafColumns().length

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          {headerGroups.map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort()
                const sorted = h.column.getIsSorted()
                return (
                  <th key={h.id} colSpan={h.colSpan}>
                    {h.isPlaceholder ? null : canSort ? (
                      <button type="button" className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                        <FlexRender header={h} />
                        {sorted === 'asc' ? <ArrowUp className="size-3.5" /> : sorted === 'desc' ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-30" />}
                      </button>
                    ) : (
                      <FlexRender header={h} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="p-8 text-center text-base-content/60">{emptyText}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Pager<TData extends Record<string, any>>({ table }: { table: Table<AppFeatures, TData> }) {
  const pageCount = table.getPageCount()
  if (pageCount <= 1) return null
  const { pageIndex } = table.state.pagination
  return (
    <div className="no-print flex items-center justify-between border-t border-base-300 p-3 text-sm">
      <span className="text-base-content/60">Halaman {pageIndex + 1} dari {pageCount}</span>
      <div className="join">
        <button type="button" className="btn join-item btn-sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Sebelumnya">
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" className="btn join-item btn-sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Berikutnya">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}