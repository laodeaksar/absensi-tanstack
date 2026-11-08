import { useQuery } from "@tanstack/react-query";

import { ErrorAlert, PageSpinner, StatusBadge } from "~/components/ui";
import { formatDate } from "~/lib/date";
import { mySubjectAttendanceQuery } from "~/lib/queries";

const MAX_ROWS = 200;

/** Ringkasan dan riwayat kehadiran per mata pelajaran milik siswa (tab pada halaman Kehadiran Saya). */
export function MySubjectAttendanceView({
  range,
}: Readonly<{ range: { startDate: string; endDate: string } }>) {
  const q = useQuery(mySubjectAttendanceQuery(range));

  return (
    <>
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
                <thead>
                  <tr>
                    <th>Mata Pelajaran</th>
                    <th>Hadir</th>
                    <th>Sakit</th>
                    <th>Izin</th>
                    <th>Alpa</th>
                    <th>% Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.summary.map((s) => (
                    <tr key={s.subject_id}>
                      <td className="font-medium">{s.subject_name}</td>
                      <td>{s.hadir}</td>
                      <td>{s.sakit}</td>
                      <td>{s.izin}</td>
                      <td>{s.alpa}</td>
                      <td className="tabular-nums">{s.persentase}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-x-auto border border-base-300 bg-base-100">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Mata Pelajaran</th>
                    <th>Status</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.records.slice(0, MAX_ROWS).map((r, i) => (
                    <tr key={`${r.date}-${r.subject_name}-${i}`}>
                      <td className="whitespace-nowrap tabular-nums">
                        {formatDate(r.date)}
                      </td>
                      <td>{r.subject_name}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>{r.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {q.data.records.length > MAX_ROWS ? (
              <p className="text-xs text-base-content/60">
                Menampilkan {MAX_ROWS} catatan terbaru dari{" "}
                {q.data.records.length}. Persempit rentang tanggal untuk melihat
                yang lain.
              </p>
            ) : null}
          </>
        )
      ) : null}
    </>
  );
}
