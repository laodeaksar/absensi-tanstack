import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

import { useValidity } from "~/hooks/use-validity";
import { errorText } from "~/utils/form";

import { FieldShell } from "./ui";

export type CheckboxOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export function CheckboxGroupField({
  label,
  field,
  options,
  hint,
  emptyText = "Tidak ada pilihan.",
  listClassName = "max-h-40",
  disabled,
}: Readonly<{
  label: string;
  field: AnyFieldApi; // nilainya string[]
  options: CheckboxOption[];
  hint?: string;
  emptyText?: string; // teks saat options kosong
  listClassName?: string; // tinggi daftar, mis. "max-h-64"; isinya bergulir
  disabled?: boolean;
}>) {
  const message = errorText(field);
  const ref = useValidity<HTMLInputElement>(message);
  const selected = (field.state.value ?? []) as string[];

  const toggle = (value: string) =>
    field.handleChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );

  return (
    <FieldShell
      label={label}
      hint={hint}
      message={message}
    >
      <div
        role="group"
        aria-label={label}
        aria-invalid={!!message}
        className={`${listClassName} space-y-2 overflow-y-auto rounded-box border p-3 ${message ? "border-error" : "border-base-300"}`}
      >
        {options.length === 0 ? (
          <p className="text-sm text-base-content/60">{emptyText}</p>
        ) : (
          options.map((o, i) => {
            const off = disabled || o.disabled;
            return (
              <label
                key={o.value}
                className={`flex items-center gap-2 text-sm ${off ? "opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  ref={i === 0 ? ref : undefined}
                  name={field.name}
                  value={o.value}
                  checked={selected.includes(o.value)}
                  disabled={off}
                  onBlur={field.handleBlur}
                  onChange={() => toggle(o.value)}
                  className={`checkbox checkbox-sm ${message ? "checkbox-error" : "checkbox-primary"}`}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {o.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </FieldShell>
  );
}
