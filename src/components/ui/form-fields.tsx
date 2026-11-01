import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { AnyFieldApi } from '@tanstack/react-form'
import { useValidity } from '~/hooks/use-validity'
import { errorText } from '~/utils/form'

/* Field TanStack Form dengan validator daisyUI (kelas `validator` + `validator-hint`). */

export function FieldShell({ 
  label, 
  hint, 
  message, 
  children 
}: { 
  label: string; 
  hint?: string; 
  message: string; 
  children: ReactNode 
}) {
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