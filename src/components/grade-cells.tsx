import type { GradeRecapCell } from "~/lib/types";

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : String(n);

export function statusOf(cell: GradeRecapCell | null) {
  if (!cell || !cell.complete)
    return { label: "Belum lengkap", cls: "text-warning" };
  return cell.passed
    ? { label: "Tuntas", cls: "text-success" }
    : { label: "Belum KKM", cls: "text-error" };
}

export function SemesterCell({
  cell,
  components,
}: Readonly<{
  cell: GradeRecapCell | null;
  components: { key: string; label: string }[];
}>) {
  const st = statusOf(cell);
  return (
    <div className="space-y-0.5">
      <p className="whitespace-nowrap">
        <span className="font-semibold">{fmt(cell?.final)}</span>{" "}
        <span className={st.cls}>{st.label}</span>
      </p>
      <p className="text-xs whitespace-nowrap text-base-content/60">
        {components
          .map((c) => `${c.label} ${fmt(cell?.values[c.key])}`)
          .join(" · ")}
      </p>
    </div>
  );
}
