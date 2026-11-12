import type { AnyFieldApi } from "@tanstack/react-form";
import type {
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { useValidity } from "~/hooks/use-validity";
import { errorText } from "~/utils/form";

/* Field TanStack Form dengan validator daisyUI (kelas `validator` + `validator-hint`). */
export function FieldShell({
  label,
  hint,
  message,
  children,
}: {
  label?: string;
  hint?: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="fieldset min-w-0">
      {label ? <legend className="fieldset-legend">{label}</legend> : null}
      {children}
      {/* Harus berada tepat setelah elemen .validator */}
      <p
        role={message ? "alert" : undefined}
        className={`validator-hint ${message ? "mt-0! block! visible! text-error wrap-anywhere" : "hidden"}`}
      >
        {message}
      </p>
      {hint && !message ? (
        <p className="label h-auto max-w-full whitespace-normal wrap-anywhere">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

type InputExtra = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "name" | "id"
>;

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
  trailing?: ReactNode;
} & InputExtra) {
  const message = errorText(field);
  const ref = useValidity<HTMLInputElement>(message);
  const wrapped = !!(icon || trailing);

  const input = (
    <input
      {...rest}
      ref={ref}
      id={field.name}
      name={field.name}
      value={field.state.value ?? ""}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={!!message}
      className={
        wrapped
          ? "grow"
          : `input validator w-full ${message ? "input-error" : ""}`
      }
    />
  );

  return (
    <FieldShell
      label={label}
      hint={hint}
      message={message}
    >
      {wrapped ? (
        // Untuk input berikon, kelas validator dipasang di <label>
        <label
          className={`input validator w-full ${message ? "input-error" : ""}`}
        >
          {icon}
          {input}
          {trailing}
        </label>
      ) : (
        input
      )}
    </FieldShell>
  );
}

export function PasswordField({ ...props }: ComponentProps<typeof TextField>) {
  const [show, setShow] = useState(false);

  return (
    <TextField
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          className="btn btn-circle btn-ghost btn-xs"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

type SelectExtra = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "onBlur" | "name" | "id"
>;

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
  children: ReactNode;
} & SelectExtra) {
  const message = errorText(field);
  const ref = useValidity<HTMLSelectElement>(message);

  return (
    <FieldShell
      label={label}
      hint={hint}
      message={message}
    >
      <select
        {...rest}
        ref={ref}
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={!!message}
        className={`select validator w-full ${message ? "select-error" : ""}`}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type TextareaExtra = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur" | "name" | "id"
>;

export function TextAreaField({
  label,
  field,
  hint,
  ...rest
}: {
  label: string;
  field: AnyFieldApi;
  hint?: string;
} & TextareaExtra) {
  const message = errorText(field);
  const ref = useValidity<HTMLTextAreaElement>(message);

  return (
    <FieldShell
      label={label}
      hint={hint}
      message={message}
    >
      <textarea
        {...rest}
        ref={ref}
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={!!message}
        className={`textarea validator w-full ${message ? "textarea-error" : ""}`}
      />
    </FieldShell>
  );
}

type CheckboxExtra = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "value" | "onChange" | "onBlur" | "name" | "id"
>;

export function CheckboxField({
  label,
  field,
  hint,
  ...rest
}: {
  label: string;
  field: AnyFieldApi;
  hint?: string;
  /** Tampil sebagai toggle daisyUI, bukan kotak centang. */
  toggle?: boolean;
} & CheckboxExtra) {
  const message = errorText(field);
  const ref = useValidity<HTMLInputElement>(message);
  // Nama kelas ditulis utuh agar terdeteksi Tailwind (jangan disusun dari potongan string)
  const style = toggle
    ? message
      ? "toggle toggle-sm toggle-error"
      : "toggle toggle-sm toggle-primary"
    : message
      ? "checkbox checkbox-sm checkbox-error"
      : "checkbox checkbox-sm checkbox-primary";

  return (
    <FieldShell
      hint={hint}
      message={message}
    >
      <label
        className={`flex min-w-0 items-center gap-2 text-sm ${rest.disabled ? "opacity-60" : "cursor-pointer"}`}
      >
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
          className={`${style} shrink-0`}
        />
        <span className="min-w-0 wrap-anywhere">{label}</span>
      </label>
    </FieldShell>
  );
}

export type RadioOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export function RadioField({
  label,
  field,
  options,
  hint,
  hideLabel = false,
  variant = "inline",
  disabled,
}: {
  label: string;
  field: AnyFieldApi;
  options: RadioOption[];
  hint?: string;
  /** Legenda disembunyikan, tapi tetap jadi nama grup untuk pembaca layar. */
  hideLabel?: boolean;
  variant?: "inline" | "card";
  disabled?: boolean;
}) {
  const message = errorText(field);
  const ref = useValidity<HTMLInputElement>(message);
  const current = String(field.state.value ?? "");

  return (
    <FieldShell
      label={hideLabel ? undefined : label}
      hint={hint}
      message={message}
    >
      <div
        role="radiogroup"
        aria-label={label}
        aria-invalid={!!message}
        className={
          variant === "card"
            ? "space-y-2"
            : "flex flex-wrap gap-x-6 gap-y-2 py-1"
        }
      >
        {options.map((o, i) => {
          const on = current === o.value;
          const off = disabled || o.disabled;
          const wrapper =
            variant === "card"
              ? `flex items-start gap-3 rounded-box border p-3 ${off ? "opacity-60" : "cursor-pointer"} ${
                  on
                    ? "border-primary bg-primary/5"
                    : message
                      ? "border-error"
                      : "border-base-300"
                }`
              : `flex items-center gap-2 text-sm ${off ? "opacity-60" : "cursor-pointer"}`;
          return (
            <label
              key={o.value}
              className={wrapper}
            >
              <input
                type="radio"
                ref={i === 0 ? ref : undefined}
                name={field.name}
                value={o.value}
                checked={on}
                disabled={off}
                onBlur={field.handleBlur}
                onChange={() => field.handleChange(o.value)}
                className={`radio radio-sm shrink-0 ${message ? "radio-error" : "radio-primary"} ${variant === "card" ? "mt-0.5" : ""}`}
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
