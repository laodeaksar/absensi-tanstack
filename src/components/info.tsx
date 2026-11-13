export function Info({
  label,
  children,
}: Readonly<{ label: string; children?: React.ReactNode }>) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-base-content/60">{label}</dt>
      <dd className="text-sm wrap-anywhere">
        {children || <span className="text-base-content/40">-</span>}
      </dd>
    </div>
  );
}
