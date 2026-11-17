import { useState } from "react";

export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  /** Teks yang harus diketik agar tombol konfirmasi aktif (tanpa membedakan huruf besar/kecil). */
  requireText?: string;
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Tampilan dialog konfirmasi. Terbuka saat `message` terisi. Logikanya ada di hooks/use-confirm.tsx. */
export function ConfirmDialog({
  message,
  title = "Konfirmasi",
  confirmLabel = "Lanjutkan",
  requireText,
  onResolve,
}: {
  message: string | null;
  onResolve: (ok: boolean) => void;
} & ConfirmOptions) {
  const [typed, setTyped] = useState("");
  const matches = !requireText || norm(typed) === norm(requireText);
  const resolve = (ok: boolean) => {
    setTyped("");
    onResolve(ok);
  };

  return (
    <dialog
      ref={(el) => {
        if (!el) return;
        if (message !== null && !el.open) el.showModal();
        if (message === null && el.open) el.close();
      }}
      className="modal modal-bottom sm:modal-middle no-print"
      onClose={() => message !== null && resolve(false)}
    >
      <form
        className="modal-box"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) resolve(true);
        }}
      >
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="py-4 whitespace-pre-line">{message}</p>
        {requireText ? (
          <label className="form-control w-full">
            <span className="label-text mb-1 block text-sm">
              Ketik <span className="font-semibold">{requireText}</span> untuk
              melanjutkan
            </span>
            <input
              className="input w-full"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`Ketik ${requireText} untuk konfirmasi`}
            />
          </label>
        ) : null}
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={() => resolve(false)}
          >
            Batal
          </button>
          <button
            type="submit"
            className={requireText ? "btn btn-error" : "btn btn-primary"}
            disabled={!matches}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
