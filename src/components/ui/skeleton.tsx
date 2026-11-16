import type { HTMLAttributes } from "react";

/** Komponen primitive placeholder shimmer */
export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton bg-base-300/70 ${className}`}
      {...props}
    />
  );
}

/** Shimmer untuk baris tabel */
export function TableSkeleton({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="card overflow-hidden border border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/50 p-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="overflow-x-auto p-4 space-y-3">
        {/* Header kolom shimmer */}
        <div className="flex items-center gap-4 pb-2 border-b border-base-200">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-4 ${
                i === 0 ? "w-10" : i === 1 ? "w-36 flex-1" : "w-24"
              }`}
            />
          ))}
        </div>
        {/* Baris data shimmer */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 py-2.5 border-b border-base-200/60 last:border-0"
          >
            <Skeleton className="h-5 w-8 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 sm:w-48" />
              <Skeleton className="h-3 w-20 opacity-60" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shimmer untuk grid kartu statistik ringkasan */
export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="stats border border-base-300 bg-base-100 p-4"
        >
          <div className="flex items-center justify-between w-full">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
            <Skeleton className="size-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shimmer untuk kartu tugas, form, atau detail data */
export function CardSkeleton() {
  return (
    <div className="card border border-base-300 bg-base-100 p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4 max-w-sm" />
        <Skeleton className="h-4 w-1/2 max-w-xs opacity-70" />
      </div>
      <div className="space-y-2 py-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/** Shimmer halaman penuh untuk pending component router */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Header Halaman */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Grid Kartu Stat */}
      <StatGridSkeleton />

      {/* Tabel Skeleton Placeholder */}
      <TableSkeleton
        rows={5}
        cols={4}
      />
    </div>
  );
}
