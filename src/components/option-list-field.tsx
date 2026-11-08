import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { errorText } from "~/utils/form";

import { FieldShell } from "./ui";

const newKey = () => Math.random().toString(36).slice(2);
const defaultLabel = (i: number) => `Pilihan ${String.fromCharCode(65 + i)}`;

export function OptionListField({
  label,
  hint,
  field,
  correctField,
  renderOption,
  optionLabel = defaultLabel,
  min = 1,
  max = Infinity,
  addLabel = "Tambah pilihan",
}: Readonly<{
  label: string;
  hint?: string;
  /** Field array berisi teks pilihan (form.Field dengan mode="array") */
  field: AnyFieldApi;
  /** Field berisi indeks jawaban benar sebagai string; "" berarti belum dipilih */
  correctField: AnyFieldApi;
  /** Gambar input teks untuk satu baris, biasanya form.Field `nama[${index}]` + TextField */
  renderOption: (index: number) => ReactNode;
  /** Nama pilihan untuk pembaca layar (radio dan tombol hapus) */
  optionLabel?: (index: number) => string;
  min?: number;
  max?: number;
  addLabel?: string;
}>) {
  const values = (field.state.value ?? []) as unknown[];
  const count = values.length;
  const correct = String(correctField.state.value ?? "");
  // Satu pesan untuk seluruh daftar: galat daftar, atau jawaban benar belum dipilih
  const message = errorText(field) || errorText(correctField);

  // Kunci baris stabil (bukan teks pilihan, agar fokus tidak hilang tiap ketikan)
  const [keys, setKeys] = useState<string[]>(() =>
    Array.from({ length: count }, () => newKey()),
  );

  const add = () => {
    const key = newKey();
    setKeys((k) => [...k, key]);
    field.pushValue("");
  };
  const removeAt = (i: number) => {
    setKeys((k) => k.filter((_, idx) => idx !== i));
    field.removeValue(i);
    if (correct !== "") {
      // jaga penanda jawaban benar tetap menunjuk baris yang sama
      const n = Number(correct);
      if (n === i) correctField.handleChange("");
      else if (n > i) correctField.handleChange(String(n - 1));
    }
  };

  return (
    <FieldShell
      label={label}
      hint={hint}
      message={message}
    >
      <div
        role="radiogroup"
        aria-label={label}
        aria-invalid={!!message}
        className="space-y-1"
      >
        {values.map((_, i) => (
          <div
            key={keys[i] ?? `opsi-${i}`}
            className="flex items-start gap-2"
          >
            <input
              type="radio"
              name={correctField.name}
              className="radio radio-primary radio-sm mt-9"
              aria-label={`Jawaban benar: ${optionLabel(i)}`}
              checked={correct === String(i)}
              onChange={() => correctField.handleChange(String(i))}
            />
            <div className="min-w-0 flex-1">{renderOption(i)}</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-8"
              disabled={count <= min}
              onClick={() => removeAt(i)}
              aria-label={`Hapus ${optionLabel(i)}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm w-fit text-primary"
        disabled={count >= max}
        onClick={add}
      >
        <Plus className="size-4" /> {addLabel}
      </button>
    </FieldShell>
  );
}
