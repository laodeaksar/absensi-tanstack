import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle no-print"
      onClose={onClose}
    >
      <div className="modal-box w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* Anak dipasang hanya saat terbuka agar form selalu mulai dari nilai awal */}
        {open ? children : null}
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
      >
        <button>Tutup</button>
      </form>
    </dialog>
  );
}
