export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`badge badge-soft badge-sm ${active ? "badge-success" : "badge-error"}`}
    >
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Hadir: "badge-success",
    Alpa: "badge-error",
    Izin: "badge-info",
    Sakit: "badge-warning",
  };

  const cl = map[status] ?? "badge-ghost";
  return (
    <span className={`badge badge-soft badge-sm ${cl}`}>{status || "-"}</span>
  );
}
