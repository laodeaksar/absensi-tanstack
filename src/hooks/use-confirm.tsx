import { useCallback, useState } from "react";

import { ConfirmDialog } from "~/components/ui/confirm-dialog";

/**
 * Dialog konfirmasi berbasis promise:
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (await confirm('Hapus data ini?')) { ... }
 *   return <>{...}{dialog}</>
 */
export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => setState({ message, resolve })),
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
        onResolve={settle}
      />
    ),
  };
}
