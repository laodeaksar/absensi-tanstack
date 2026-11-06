import type { AnyFormApi } from "@tanstack/react-form";

import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { MessageSquareText, Save } from "lucide-react";
import { useMemo, useState } from "react";

import type { AttendanceEntry } from "~/lib/types";

import { DataTable, Modal, TextAreaField } from "~/components/ui";
import { gridSchema } from "~/lib/attendance-schema";
import { STATUS_VALUES } from "~/convex/rules"
import { LIMITS, needsNotes } from "~/convex/limits"
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";

/* type Row = {
  student_id: string;
  nis: string;
  full_name: string;
  status: string;
  notes: string;
}; */
type Row = Omit<AttendanceEntry, "attendance_id">;
const col = columnHelperFor<Row>();

const STATUS_STYLE = {
  Hadir: {
    tone: "checkbox-success",
    text: "text-success",
  },
  Sakit: {
    tone: "checkbox-warning",
    text: "text-warning",
  },
  Izin: {
    tone: "checkbox-info",
    text: "text-info",
  },
  Alpa: {
    tone: "checkbox-error",
    text: "text-error",
  },
} as const;

/** Tombol keterangan per baris: hanya muncul untuk status yang butuh keterangan. */
function NotesButton({
  form,
  index,
  onOpen,
}: Readonly<{
  form: AnyFormApi;
  index: number;
  onOpen: (i: number) => void;
}>) {
  const row = useSelector(form.store, (s) => s.values.rows[index]);
  const attempts = useSelector(form.store, (s) => s.submissionAttempts);
  if (!row || !needsNotes(row.status)) return null;

  const filled = row.notes.trim().length >= LIMITS.notesMin;
  const tone = filled
    ? "text-success"
    : attempts > 0
      ? "text-error"
      : "text-warning";
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-xs ${tone}`}
      aria-label={filled ? "Ubah keterangan" : "Isi keterangan"}
      title={row.notes || "Isi keterangan"}
      onClick={() => onOpen(index)}
    >
      <MessageSquareText className="size-4" />
    </button>
  );
}

export type AttendancePayload = {
  student_id: string;
  status: string;
  notes: string;
};

/**
 * Grid absensi bersama: absensi harian dan absensi per mata pelajaran.
 * Halaman pemanggil menentukan cara menyimpan dan query apa yang perlu dimuat ulang.
 * Render ulang dengan `key` baru setelah data server berubah agar form mulai dari data terbaru.
 */
export function AttendanceGrid({
  entries,
  save: saveRows,
  onSaved,
  emptyText = "Tidak ada siswa terdaftar di kelas ini.",
}: Readonly<{
  entries: AttendanceEntry[];
  /** Simpan baris yang sudah terisi; galat dilempar agar tampil sebagai toast. */
  save: (payload: AttendancePayload[]) => Promise<{ message: string }>;
  /** Dipanggil setelah berhasil menyimpan (mis. memuat ulang query terkait). */
  onSaved: () => void;
  emptyText?: string;
}>) {

  const rows = useMemo<Row[]>(
    () =>
      entries.map((e) => ({
        student_id: e.student_id,
        nis: e.nis,
        full_name: e.full_name,
        status: e.status === "Belum Ada" ? "" : e.status,
        notes: e.notes,
      })),
    [entries],
  );

  const save = useMutation({
    mutationFn: (payload: AttendancePayload[]) => saveRows(payload),
    onSuccess: (r) => {
      toast.success(r.message || "Data berhasil disimpan");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm({
    defaultValues: { rows },
    validators: {
      onChange: gridSchema,
      onSubmit: gridSchema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      const payload = value.rows
        .filter((r) => r.status)
        .map(({ student_id, status, notes }) => ({
          student_id,
          status,
          notes: notes.trim(),
        }));
      if (payload.length === 0) {
        toast.error("Tidak ada data absensi untuk disimpan");
        return;
      }
      await save.mutateAsync(payload).catch(() => {});
    },
  });

  const [noteRow, setNoteRow] = useState<number | null>(null);
  const openNote = (i: number) => setNoteRow(i);

  // Batal/tutup tanpa keterangan yang cukup: pilihan status dibatalkan
  const closeNote = () => {
    if (noteRow !== null) {
      const r = form.state.values.rows[noteRow];
      if (r && needsNotes(r.status) && r.notes.trim().length < LIMITS.notesMin) {
        form.setFieldValue(`rows[${noteRow}].status` as const, "");
      }
    }
    setNoteRow(null);
  };

  const markAll = (status: string) => {
    rows.forEach((_, i) =>
      form.setFieldValue(`rows[${i}].status` as const, status),
    );
  };

  const columns = useMemo(
    () =>
      col.columns([
        col.display({
          id: "no",
          header: "No",
          cell: ({ row }) => row.index + 1,
        }),
        col.accessor("nis", {
          header: "NIS",
          enableSorting: false,
        }),
        col.accessor("full_name", {
          header: "Nama Siswa",
          enableSorting: false,
          cell: (i) => <span className="font-medium">{i.getValue()}</span>,
        }),
        ...STATUS_VALUES.map((s) =>
          col.display({
            id: s,
            // Hanya "Hadir" yang bisa ditandai massal: status lain butuh keterangan per siswa
            header: () =>
              s === "Hadir" ? (
                <button
                  type="button"
                  title={`Tandai semua ${s}`}
                  onClick={() => markAll(s)}
                  className={`btn btn-ghost btn-xs ${STATUS_STYLE[s].text}`}
                >
                  {s}
                </button>
              ) : (
                <span className={`text-xs font-semibold ${STATUS_STYLE[s].text}`}>
                  {s}
                </span>
              ),
            cell: ({ row }) => (
              <form.Field name={`rows[${row.index}].status` as const}>
                {(f) => (
                  <div className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`${s}: ${row.original.full_name}`}
                      className={`checkbox checkbox-sm ${STATUS_STYLE[s].tone}`}
                      checked={f.state.value === s}
                      onChange={(e) => {
                        const next = e.target.checked ? s : "";
                        f.handleChange(next);
                        if (next && needsNotes(next)) openNote(row.index);
                      }}
                    />
                  </div>
                )}
              </form.Field>
            ),
          }),
        ),
        col.display({
          id: "notes",
          header: "Ket.",
          cell: ({ row }) => (
            <NotesButton
              form={form}
              index={row.index}
              onOpen={openNote}
            />
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 1000,
      },
    },
  });

  return (
    <form
      noValidate
      className="card overflow-hidden border border-base-300 bg-base-100"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 p-4">
        <h3 className="font-semibold">Daftar Siswa</h3>
        <button
          type="button"
          onClick={() => markAll("Hadir")}
          className="btn btn-ghost btn-sm text-primary"
        >
          Tandai Semua Hadir
        </button>
      </div>

      <DataTable
        table={table}
        emptyText={emptyText}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 p-4">
        {/* Ringkasan dinamis dari nilai form */}
        <form.Subscribe selector={(s) => s.values.rows}>
          {(vals) => {
            const filled = vals.filter((r) => r.status).length;
            const missing = vals.filter(
              (r) => needsNotes(r.status) && r.notes.trim().length < LIMITS.notesMin,
            ).length;
            return (
              <p className="text-sm text-base-content/70">
                Terisi {filled} dari {vals.length} siswa
                {missing > 0 ? (
                  <span className="ml-2 text-error">
                    · {missing} perlu keterangan
                  </span>
                ) : null}
              </p>
            );
          }}
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || rows.length === 0}
            >
              {busy ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Save className="size-4" />
              )}
              Simpan Data Absensi
            </button>
          )}
        </form.Subscribe>
      </div>

      <Modal
        open={noteRow !== null}
        onClose={closeNote}
        title="Keterangan Absensi"
      >
        {noteRow !== null ? (
          <div className="space-y-3">
            <form.Subscribe selector={(s) => s.values.rows[noteRow]}>
              {(r) => (
                <p className="text-sm">
                  <span className="font-medium">{r?.full_name}</span> ·{" "}
                  {r?.status}
                </p>
              )}
            </form.Subscribe>

            <form.Field name={`rows[${noteRow}].notes` as const}>
              {(f) => (
                <TextAreaField
                  autoFocus
                  label="Keterangan"
                  field={f}
                  rows={3}
                  hint={`Minimal ${LIMITS.notesMin} karakter.`}
                />
              )}
            </form.Field>

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={closeNote}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const r = form.state.values.rows[noteRow];
                  if (r && r.notes.trim().length >= LIMITS.notesMin) setNoteRow(null);
                  else toast.error(`Keterangan minimal ${LIMITS.notesMin} karakter.`);
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </form>
  );
}