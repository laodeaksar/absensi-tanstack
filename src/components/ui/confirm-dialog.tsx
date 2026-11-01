/** Tampilan dialog konfirmasi. Terbuka saat `message` terisi. Logikanya ada di hooks/use-confirm.tsx. */
export function ConfirmDialog({ message, onResolve }: { message: string | null; onResolve: (ok: boolean) => void }) {
  return (
    <dialog
      ref={(el) => {
        if (!el) return
        if (message !== null && !el.open) el.showModal()
        if (message === null && el.open) el.close()
      }}
      className="modal modal-bottom sm:modal-middle no-print"
      onClose={() => message !== null && onResolve(false)}
    >
      <div className="modal-box">
        <h3 className="text-lg font-bold">Konfirmasi</h3>
        <p className="whitespace-pre-line py-4">{message}</p>
        <div className="modal-action">
          <button 
            type="button" 
            className="btn" 
            onClick={() => onResolve(false)}
          >
            Batal
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => onResolve(true)}
          >
            Lanjutkan
          </button>
        </div>
      </div>
    </dialog>
  )
}