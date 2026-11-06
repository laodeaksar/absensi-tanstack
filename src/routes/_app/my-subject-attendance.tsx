import { useForm } from "@tanstack/react-form";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ErrorAlert, PageSpinner, TextField } from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { formatDate, monthStart, todayStr } from "~/lib/date";
import { mySubjectAttendanceQuery, settingsQuery } from "~/lib/queries";
import { makeMyRangeSchema } from "~/lib/report-schema";

export const Route = createFileRoute("/_app/my-subject-attendance")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  loader: ({ context }) => context.queryClient.query(settingsQuery),
  component: MySubjectAttendancePage,
});

const BADGE: Record<string, string> = {
  Hadir: "badge-success", Sakit: "badge-warning", Izin: "badge-info", Alpa: "badge-error",
};
const MAX_ROWS = 200;

function MySubjectAttendancePage() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const tzRaw = settings.tz_offset_minutes;
  const tz = tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;
  const schema = useMemo(() => makeMyRangeSchema(tz), [tz]);

  const [range, setRange] = useState(() => ({ startDate: monthStart(), endDate: todayStr(tz) }));
  const q = useQuery(mySubjectAttendanceQuery(range));

  const form = useForm({
    defaultValues: range,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => setRange(value),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Kehadiran per Mata Pelajaran</h2>

      <div className="card border border-base-300 bg-base-100">
        <form noValidate
          className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-3"
          onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }}>
          <form.Field name="startDate">
            {(f) => <TextField label="Dari Tanggal" field={f} type="date" />}
          </form.Field>
          <form.Field name="endDate">
            {(f) => <TextField label="Sampai Tanggal" field={f} type="date" max={todayStr(tz)} />}
          </form.Field>
          <button type="submit" className="btn btn-primary mt-6 w-full">Tampilkan</button>
        </form>
      </div>

      {q.isPending ? <PageSpinner /> : null}
      <ErrorAlert message={q.error?.message} />

      {q.data ? (
        q.data.summary.length === 0 ? (
          <p className="text-sm text-base-content/70">
            Belum ada absensi mata pelajaran pada rentang ini.
          </p>
        ) : (
          <>
            <div className="card overflow-x-auto border border-base-300 bg-base-100">
              <table className="table">
                <thead><tr>
                  <th>Mata Pelajaran</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alpa</th><th>% Hadir</th>
                </tr></thead>
                <tbody>
                  {q.data.summary.map((s) => (
                    <tr key={s.subject_id}>
                      <td className="font-medium">{s.subject_name}</td>
                      <td>{s.hadir}</td><td>{s.sakit}</td><td>{s.izin}</td><td>{s.alpa}</td>
                      <td className="tabular-nums">{s.persentase}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-x-auto border border-base-300 bg-base-100">
              <table className="table">
                <thead><tr><th>Tanggal</th><th>Mata Pelajaran</th><th>Status</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {q.data.records.slice(0, MAX_ROWS).map((r, i) => (
                    <tr key={`${r.date}-${r.subject_name}-${i}`}>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(r.date)}</td>
                      <td>{r.subject_name}</td>
                      <td><span className={`badge ${BADGE[r.status] ?? ""}`}>{r.status}</span></td>
                      <td>{r.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {q.data.records.length > MAX_ROWS ? (
              <p className="text-xs text-base-content/60">
                Menampilkan {MAX_ROWS} catatan terbaru dari {q.data.records.length}.
                Persempit rentang tanggal untuk melihat yang lain.
              </p>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}