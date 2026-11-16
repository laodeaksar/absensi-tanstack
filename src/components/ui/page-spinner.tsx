import { PageSkeleton } from "./skeleton";

/** Digunakan oleh router sebagai `defaultPendingComponent` dan pada loading state route-level. */
export function PageSpinner() {
  return <PageSkeleton />;
}

/** Spinner kecil inline — cocok untuk bagian kecil halaman yang sedang di-refresh. */
export function InlineSpinner() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}
