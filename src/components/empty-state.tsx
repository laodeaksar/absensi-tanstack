import type { ReactNode } from "react";

import { SearchX } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: Readonly<{
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}>) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-2 px-4 py-6 text-center"
          : "flex flex-col items-center gap-3 px-4 py-10 text-center"
      }
    >
      <div
        className={
          compact
            ? "flex size-12 items-center justify-center rounded-full bg-base-200 text-base-content/40 [&>svg]:size-6"
            : "flex size-16 items-center justify-center rounded-full bg-base-200 text-base-content/40 [&>svg]:size-8"
        }
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? (
          <p className="max-w-xs text-sm text-base-content/60">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function NoResultsState({
  subject,
  query,
  onClear,
}: Readonly<{ subject: string; query: string; onClear: () => void }>) {
  return (
    <EmptyState
      icon={<SearchX />}
      title={`${subject} tidak ditemukan`}
      description={`Tidak ada hasil untuk "${query}".`}
      action={
        <button
          type="button"
          className="btn btn-sm"
          onClick={onClear}
        >
          Hapus pencarian
        </button>
      }
    />
  );
}
