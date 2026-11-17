import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarX2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import type { HomeroomClass } from "~/lib/types";

import { EmptyState } from "~/components/empty-state";
import { formatDate } from "~/lib/date";
import { homeroomOverviewQuery } from "~/lib/queries";

const STAT_TONE = {
  hadir: "text-success",
  sakit: "text-warning",
  izin: "text-info",
  alpa: "text-error",
} as const;

const STATUS_BADGE: Record<string, string> = {
  Alpa: "badge badge-error badge-sm",
  Sakit: "badge badge-warning badge-sm",
  Izin: "badge badge-info badge-sm",
};

function Stat({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: number; tone?: string }>) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-3 text-center">
      <p className={`text-2xl font-bold ${tone ?? ""}`}>{value}</p>
      <p className="text-xs text-base-content/60">{label}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ClassOverview({
  cls,
  date,
}: Readonly<{ cls: HomeroomClass; date: string }>) {
  const d = cls.daily;
  const unmarked = cls.total - d.filled;

  return (
    <div className="space-y-5">
      <Section title={`Absensi Harian - ${formatDate(date)}`}>
        {d.filled === 0 ? (
          <EmptyState
            compact
            icon={<CalendarX2 />}
            title="Absensi harian belum diisi"
            description={`Belum ada absensi hari ini untuk ${cls.total} siswa.`}
            action={
              <Link
                to="/attendance"
                className="btn btn-sm btn-primary"
              >
                Isi Absensi
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Hadir" value={d.hadir} tone={STAT_TONE.hadir} />
              <Stat label="Sakit" value={d.sakit} tone={STAT_TONE.sakit} />
              <Stat label="Izin" value={d.izin} tone={STAT_TONE.izin} />
              <Stat label="Alpa" value={d.alpa} tone={STAT_TONE.alpa} />
              <Stat label="Belum diabsen" value={unmarked} />
            </div>
            {unmarked > 0 ? (
              <p className="text-xs text-base-content/60">
                Belum diabsen:{" "}
                {cls.unmarked.map((s) => s.full_name).join(", ")}
                {cls.unmarked_count > cls.unmarked.length
                  ? ` dan ${cls.unmarked_count - cls.unmarked.length} lainnya`
                  : ""}
                .
              </p>
            ) : null}
          </>
        )}
      </Section>

      {d.filled > 0 ? (
        <Section title="Perlu Perhatian Hari Ini">
          {cls.attention.length ? (
            <ul className="divide-y divide-base-300 rounded-box border border-base-300">
              {cls.attention.map((a) => (
                <li
                  key={a.student_id}
                  className="flex items-start justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {a.full_name}
                    </p>
                    {a.notes ? (
                      <p className="text-xs text-base-content/60 [overflow-wrap:anywhere]">
                        {a.notes}
                      </p>
                    ) : null}
                  </div>
                  <span className={STATUS_BADGE[a.status] ?? "badge badge-sm"}>
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Semua siswa yang diabsen
              hadir.
            </p>
          )}
        </Section>
      ) : null}

      <Section title="Alpa Terbanyak 7 Hari Terakhir">
        {cls.frequentAlpa.length ? (
          <ul className="divide-y divide-base-300 rounded-box border border-base-300">
            {cls.frequentAlpa.map((a) => (
              <li
                key={a.student_id}
                className="flex items-center justify-between gap-2 p-3"
              >
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                  {a.full_name}
                </span>
                <span className="badge badge-error badge-sm whitespace-nowrap">
                  {a.count}x alpa
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-base-content/60">
            Tidak ada alpa dalam 7 hari terakhir.
          </p>
        )}
      </Section>

      <Section title="Absensi per Mata Pelajaran Hari Ini">
        {cls.subjects.length ? (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Mapel</th>
                  <th>Terisi</th>
                  <th>H</th>
                  <th>S</th>
                  <th>I</th>
                  <th>A</th>
                </tr>
              </thead>
              <tbody>
                {cls.subjects.map((s) => (
                  <tr key={s.subject_id}>
                    <td>
                      <p className="font-medium">{s.subject_name}</p>
                      <p className="text-xs text-base-content/60">
                        {s.teacher}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      {s.filled === 0 ? (
                        <span className="text-warning">Belum diisi</span>
                      ) : (
                        `${s.filled}/${cls.total}`
                      )}
                    </td>
                    <td>{s.filled ? s.hadir : "-"}</td>
                    <td>{s.filled ? s.sakit : "-"}</td>
                    <td>{s.filled ? s.izin : "-"}</td>
                    <td className={s.alpa ? "font-semibold text-error" : undefined}>
                      {s.filled ? s.alpa : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            Belum ada mata pelajaran yang diampu di kelas ini.
          </p>
        )}
      </Section>
    </div>
  );
}

/** Ringkasan kelas bimbingan untuk guru yang menjadi wali kelas. Tidak tampil bila bukan wali kelas. */
export function HomeroomOverview() {
  const { data } = useQuery(homeroomOverviewQuery);
  const [active, setActive] = useState(0);

  if (!data?.classes.length) return null;
  const cls = data.classes[Math.min(active, data.classes.length - 1)];

  return (
    <div className="card border border-base-300 bg-base-100">
      <div className="card-body space-y-4">
        <div>
          <h2 className="card-title">Kelas Bimbingan</h2>
          <p className="text-sm text-base-content/60">
            {cls.class_name} ({cls.academic_year || "-"}) - {cls.total} siswa
            aktif
          </p>
        </div>
        {data.classes.length > 1 ? (
          <div
            role="tablist"
            className="tabs tabs-border"
          >
            {data.classes.map((c, i) => (
              <button
                key={c.class_id}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={i === active ? "tab tab-active" : "tab"}
                onClick={() => setActive(i)}
              >
                {c.class_name}
              </button>
            ))}
          </div>
        ) : null}
        <ClassOverview
          cls={cls}
          date={data.date}
        />
      </div>
    </div>
  );
}