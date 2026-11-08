import { useForm } from "@tanstack/react-form";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import type { MyAttendance } from "~/lib/types";

import { MySubjectAttendanceView } from "~/components/my-subject-attendance-view";
import {
  DataTable,
  ErrorAlert,
  PageSpinner,
  Pager,
  StatusBadge,
  TextField,
} from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { monthStart, todayStr } from "~/lib/date";
import { myAttendanceQuery, settingsQuery } from "~/lib/queries";
import { makeMyRangeSchema } from "~/lib/report-schema";
import { columnHelperFor, features } from "~/lib/table";

export const Route = createFileRoute("/_app/my-attendance")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  // tab "mapel": kehadiran per mata pelajaran; kosong = harian
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "mapel" ? ("mapel" as const) : undefined,
  }),
  component: MyAttendancePage,
});

type Rec = MyAttendance["records"][number];
const col = columnHelperFor<Rec>();
const columns = col.columns([
  col.accessor("date", { header: "Tanggal" }),
  col.accessor("status", {
    header: "Status",
    cell: (i) => <StatusBadge status={i.getValue()} />,
  }),
  col.accessor("notes", {
    header: "Keterangan",
    enableSorting: false,
    cell: (i) => i.getValue() || "-",
  }),
]);

type Range = { startDate: string; endDate: string };

function MyAttendancePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  // "Hari ini" mengikuti zona waktu sekolah (sama dengan server), bukan jam perangkat
  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  const tab = search.tab === "mapel" ? "mapel" : "harian";
  // Rentang tanggal dipakai bersama kedua tab
  const [range, setRange] = useState<Range>(() => ({
    startDate: monthStart(),
    endDate: todayStr(tz),
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Kehadiran Saya</h2>

      <div className="join">
        <button
          type="button"
          className={`btn join-item btn-sm ${tab === "harian" ? "btn-primary" : ""}`}
          onClick={() =>
            void navigate({ to: "/my-attendance", search: { tab: undefined } })
          }
        >
          Harian
        </button>
        <button
          type="button"
          className={`btn join-item btn-sm ${tab === "mapel" ? "btn-primary" : ""}`}
          onClick={() =>
            void navigate({ to: "/my-attendance", search: { tab: "mapel" } })
          }
        >
          Per Mata Pelajaran
        </button>
      </div>

      <RangeForm
        range={range}
        onRange={setRange}
        tz={tz}
      />

      {tab === "harian" ? (
        <DailyAttendanceView range={range} />
      ) : (
        <MySubjectAttendanceView range={range} />
      )}
    </div>
  );
}

function RangeForm({
  range,
  onRange,
  tz,
}: Readonly<{ range: Range; onRange: (r: Range) => void; tz?: number }>) {
  // Aturan: tanggal wajib, awal <= akhir, akhir tidak di masa depan, rentang dibatasi
  const schema = useMemo(() => makeMyRangeSchema(tz), [tz]);

  const form = useForm({
    defaultValues: range,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => onRange(value),
  });

  return (
    <div className="card border border-base-300 bg-base-100">
      <form
        noValidate
        className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="startDate">
          {(f) => (
            <TextField
              label="Dari Tanggal"
              field={f}
              type="date"
              max={todayStr(tz)}
            />
          )}
        </form.Field>
        <form.Field name="endDate">
          {(f) => (
            <TextField
              label="Sampai Tanggal"
              field={f}
              type="date"
              max={todayStr(tz)}
            />
          )}
        </form.Field>
        <button
          type="submit"
          className="btn btn-primary mt-6 w-full"
        >
          Tampilkan
        </button>
      </form>
    </div>
  );
}

function DailyAttendanceView({ range }: Readonly<{ range: Range }>) {
  const q = useQuery(myAttendanceQuery(range));
  const data = q.data?.records ?? [];
  const table = useTable({
    features,
    columns,
    data,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 15 },
    },
  });

  const p = q.data?.profile;
  const s = q.data?.summary;

  return (
    <>
      {p ? (
        <p className="text-sm text-base-content/60">
          {p.full_name} - NIS {p.nis || "-"} - Kelas {p.class_name || "-"}
        </p>
      ) : null}

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body flex-row items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-base-content/60">Status hari ini</p>
            {q.data?.today?.notes ? (
              <p className="mt-1 text-xs text-base-content/60">
                {q.data.today.notes}
              </p>
            ) : null}
          </div>
          <StatusBadge
            status={
              q.data
                ? q.data.today
                  ? q.data.today.status
                  : "Belum diisi"
                : "..."
            }
          />
        </div>
      </div>

      {q.isPending ? <PageSpinner /> : null}
      <ErrorAlert message={q.error?.message} />

      {s ? (
        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
          <div className="stat">
            <div className="stat-title">Hadir</div>
            <div className="stat-value text-2xl text-success">{s.hadir}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Sakit</div>
            <div className="stat-value text-2xl text-warning">{s.sakit}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Izin</div>
            <div className="stat-value text-2xl text-info">{s.izin}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Alpa</div>
            <div className="stat-value text-2xl text-error">{s.alpa}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Kehadiran</div>
            <div className="stat-value text-2xl text-primary">
              {s.persentase}%
            </div>
          </div>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable
          table={table}
          emptyText="Belum ada data absensi pada periode ini."
        />
        <Pager table={table} />
      </div>
    </>
  );
}
