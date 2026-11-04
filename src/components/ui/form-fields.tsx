import type {
  ComponentProps,
  InputHTMLAttributes, 
  ReactNode,
  SelectHTMLAttributes, 
  TextareaHTMLAttributes
} from 'react'
import { useState } from "react"
import type { AnyFieldApi } from '@tanstack/react-form'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useValidity } from '~/hooks/use-validity'
import { errorText } from '~/utils/form'

/* Field TanStack Form dengan validator daisyUI (kelas `validator` + `validator-hint`). */
function FieldShell({ 
  label,
  hint, 
  message, 
  children 
}: {
  label?: string;
  hint?: string;
  message: string; 
  children: ReactNode
}) {
  return (
    <fieldset className="fieldset min-w-0">
      {label ? <legend className="fieldset-legend">{label}</legend> : null}
      {children}
      {/* Harus berada tepat setelah elemen .validator */}
      <p
        role={message ? 'alert' : undefined}
        className={`validator-hint ${message ? 'mt-0! block! visible! text-error [overflow-wrap:anywhere]' : 'hidden'}`}
      >
        {message}
      </p>
      {hint && !message ? (
        <p className="label h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]">{hint}</p>
      ) : null}
    </fieldset>
  )
}

type InputExtra = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function TextField({
  label, 
  field, 
  hint,
  icon, 
  trailing,
  ...rest
}: { 
  label: string; 
  field: AnyFieldApi; 
  hint?: string; 
  icon?: ReactNode; 
  trailing?: ReactNode 
} & InputExtra) {
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

export function PasswordField({
  ...props
}: Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>) {
  const [show, setShow] = useState(false)

  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
          className="btn btn-circle btn-ghost btn-xs"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
}

type SelectExtra = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function SelectField({
  label, 
  field, 
  hint, 
  children, 
  ...rest
}: { 
  label: string; 
  field: AnyFieldApi;
  hint?: string; 
  children: ReactNode
} & SelectExtra) {
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

type TextareaExtra = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>

export function TextAreaField({ 
  label, 
  field, 
  hint, 
  ...rest 
}: { 
  label: string; 
  field: AnyFieldApi; 
  hint?: string 
} & TextareaExtra) {
  const message = errorText(field)
  const ref = useValidity<HTMLTextAreaElement>(message)

  return (
    <FieldShell label={label} hint={hint} message={message}>
      <textarea
        {...rest}
        ref={ref}
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={!!message}
        className={`textarea validator w-full ${message ? 'textarea-error' : ''}`}
      />
    </FieldShell>
  )
}

type CheckboxExtra = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'checked' | 'value' | 'onChange' | 'onBlur' | 'name' | 'id'
>

export function CheckboxField({ 
  label, 
  field, 
  hint, 
  ...rest 
}: {
  label: string; 
  field: AnyFieldApi; 
  hint?: string
} & CheckboxExtra) {
  const message = errorText(field)
  const ref = useValidity<HTMLInputElement>(message)

  return (
    <FieldShell hint={hint} message={message}>
      <label className={`flex min-w-0 items-center gap-2 text-sm ${rest.disabled ? 'opacity-60' : 'cursor-pointer'}`}>
        <input
          {...rest}
          ref={ref}
          type="checkbox"
          id={field.name}
          name={field.name}
          checked={!!field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.checked)}
          aria-invalid={!!message}
          className={`checkbox checkbox-sm shrink-0 ${message ? 'checkbox-error' : 'checkbox-primary'}`}
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
      </label>
    </FieldShell>
  )
}