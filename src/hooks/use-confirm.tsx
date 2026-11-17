import { useCallback, useState } from "react";

import type { ConfirmOptions } from "~/components/ui/confirm-dialog";

import { ConfirmDialog } from "~/components/ui/confirm-dialog";

/**
 * Dialog konfirmasi berbasis promise:
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (await confirm('Hapus data ini?')) { ... }
 *   // tindakan kritis: wajib mengetik teks tertentu
 *   if (await confirm('Luluskan siswa?', { requireText: nama, confirmLabel: 'Ya, luluskan' })) { ... }
 *   return <>{...}{dialog}</>
 */
export function useConfirm() {
  const [state, setState] = useState<
    | (ConfirmOptions & {
        message: string;
        resolve: (v: boolean) => void;
      })
    | null
  >(null);

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) =>
        setState({ message, resolve, ...options }),
      ),
    [],
  );

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        message={state?.message ?? null}
        title={state?.title}
        confirmLabel={state?.confirmLabel}
        requireText={state?.requireText}
        onResolve={settle}
      />
    ),
  };
}
