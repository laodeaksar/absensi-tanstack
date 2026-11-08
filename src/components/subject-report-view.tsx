import { useForm } from "@tanstack/react-form";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { Printer } from "lucide-react";
import { useMemo } from "react";

import type { SubjectReportRow } from "~/lib/types";

import { HeaderButton, PageHeader } from "~/components/status-icons";
import {
  DataTable,
  ErrorAlert,
  PageSpinner,
  Pager,
  SelectField,
  TextField,
} from "~/components/ui";
import { formatDate, monthStart, todayStr } from "~/lib/date";
import {
  settingsQuery,
  subjectReportQuery,
  teachingQuery,
} from "~/lib/queries";
import {
  makeSubjectReportFilterSchema,
  pairKey,
  parsePair,
} from "~/lib/subject-attendance-schema";
import { columnHelperFor, features } from "~/lib/table";

const col = columnHelperFor<SubjectReportRow>();
const num = (v: number) => <span className="tabular-nums">{v}</span>;

const columns = col.columns([
  col.display({
    id: "no",
    header: "No",
    cell: ({ row }) => row.index + 1,
  }),
  col.accessor("nis", { header: "NIS" }),
  col.accessor("full_name", {
    header: "Nama Siswa",
    cell: (i) => <span className="font-medium">{i.getValue()}</span>,
  }),
  col.accessor("hadir", {
    header: "Hadir",
    cell: (i) => <span className="text-success">{num(i.getValue())}</span>,
  }),
  col.accessor("sakit", {
    header: "Sakit",
    cell: (i) => <span className="text-warning">{num(i.getValue())}</span>,
  }),
  col.accessor("izin", {
    header: "Izin",
    cell: (i) => <span className="text-info">{num(i.getValue())}</span>,
  }),
  col.accessor("alpa", {
    header: "Alpa",
    cell: (i) => <span className="text-error">{num(i.getValue())}</span>,
  }),
  col.accessor("total", { header: "Total", cell: (i) => num(i.getValue()) }),
  col.accessor("persentase", {
    header: "% Hadir",
    cell: (i) => <span className="tabular-nums">{i.getValue()}%</span>,
  }),
]);

/**
 * Rekap absensi per mata pelajaran (tab pada halaman Laporan).
 * Parameter pencarian dan pemindahan halaman dikelola halaman pemanggil lewat props.
 */
export function SubjectReportView({
  search,
  onSearch,
}: Readonly<{
  search: {
    pair?: string;
    startDate?: string;
    endDate?: string;
    go?: boolean;
  };
  onSearch: (v: { pair: string; startDate: string; endDate: string }) => void;
}>) {
  // Guru: hanya pengampu miliknya. Admin: semua pengampu yang terdaftar.
  const { data: teaching } = useSuspenseQuery(teachingQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  // Rekap boleh dilihat untuk mapel yang sudah dinonaktifkan; yang dibutuhkan hanya pasangan pengampu
  const options = teaching;
  const pairs = useMemo(
    () => options.map((t) => pairKey(t.class_id, t.subject_id)),
    [options],
  );
  const schema = useMemo(
    () => makeSubjectReportFilterSchema({ pairs }),
    [pairs],
  );

  // Parameter URL divalidasi dengan aturan yang sama sebelum data diminta
  const urlCheck = useMemo(
    () =>
      search.go
        ? schema.safeParse({
            pair: search.pair ?? "",
            startDate: search.startDate ?? "",
            endDate: search.endDate ?? "",
          })
        : null,
    [schema, search.go, search.pair, search.startDate, search.endDate],
  );

  const picked = urlCheck?.success ? parsePair(urlCheck.data.pair) : null;
  const report = useQuery({
    ...subjectReportQuery({
      startDate: search.startDate ?? "",
      endDate: search.endDate ?? "",
      classId: picked?.classId ?? "",
      subjectId: picked?.subjectId ?? "",
    }),
    enabled: !!picked,
  });
  const data = useMemo(() => report.data?.data ?? [], [report.data]);
  const meta = report.data?.meta;

  const form = useForm({
    defaultValues: {
      pair: search.pair ?? "",
      startDate: search.startDate ?? monthStart(),
      endDate: search.endDate ?? todayStr(tz),
    },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => onSearch(value),
  });

  const table = useTable({
    features,
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
  });

  const avg = useMemo(() => {
    const withData = data.filter((r) => r.total > 0);
    if (withData.length === 0) return 0;
    return (
      Math.round(
        (withData.reduce((a, r) => a + r.persentase, 0) / withData.length) * 10,
      ) / 10
    );
  }, [data]);

  // Cetak semua baris: perbesar ukuran halaman sementara, kembalikan setelah dialog cetak
  const print = () => {
    const prev = table.state.pagination.pageSize;
    table.setPageSize(Math.max(data.length, 1));
    const restore = () => {
      table.setPageSize(prev);
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rekap Absensi Mata Pelajaran"
        className="no-print"
      >
        <HeaderButton
          label="Cetak Rekap"
          className="btn-neutral"
          icon={<Printer className="size-4" />}
          onClick={print}
          disabled={data.length === 0}
        />
      </PageHeader>

      <div className="card no-print border border-base-300 bg-base-100">
        <form
          noValidate
          className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="pair">
            {(f) => (
              <SelectField
                label="Kelas dan Mata Pelajaran"
                field={f}
              >
                <option
                  disabled
                  value=""
                >
                  -- Pilih --
                </option>
                {options.map((t) => (
                  <option
                    key={t.teaching_id}
                    value={pairKey(t.class_id, t.subject_id)}
                  >
                    {t.class_name} · {t.subject_name}
                  </option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <form.Field name="startDate">
            {(f) => (
              <TextField
                label="Dari Tanggal"
                field={f}
                type="date"
              />
            )}
          </form.Field>
          <form.Field name="endDate">
            {(f) => (
              <TextField
                label="Sampai Tanggal"
                field={f}
                type="date"
              />
            )}
          </form.Field>
          <button
            type="submit"
            className="btn btn-primary mt-6 w-full"
            disabled={options.length === 0}
          >
            Tampilkan Rekap
          </button>
          {options.length === 0 ? (
            <p className="text-warning text-sm md:col-span-full">
              Belum ada mata pelajaran yang Anda ampu.
            </p>
          ) : null}
        </form>
      </div>

      {/* Kop cetak */}
      <div className="print-only mb-6 hidden border-b pb-4 text-center">
        <h1 className="text-2xl font-bold">{settings.school_name}</h1>
        {settings.school_address ? (
          <p className="text-sm">{settings.school_address}</p>
        ) : null}
        <h2 className="mt-2 text-lg font-semibold">
          Rekap Absensi Mata Pelajaran
        </h2>
        {meta ? (
          <p className="text-base-content/70">
            {meta.subject_name} · Kelas {meta.class_name}
          </p>
        ) : null}
        <p className="text-base-content/70">
          Periode: {formatDate(search.startDate)} s.d{" "}
          {formatDate(search.endDate)}
        </p>
        {meta ? (
          <p className="text-base-content/70">
            Jumlah pertemuan tercatat: {meta.meetings}
          </p>
        ) : null}
      </div>

      {urlCheck && !urlCheck.success ? (
        <ErrorAlert message={urlCheck.error.issues[0]?.message} />
      ) : null}
      {report.isFetching && picked ? <PageSpinner /> : null}
      <ErrorAlert message={report.error?.message} />

      {meta ? (
        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 md:stats-horizontal">
          <div className="stat">
            <div className="stat-title">Mata Pelajaran</div>
            <div className="stat-value text-xl text-primary">
              {meta.subject_name}
            </div>
            <div className="stat-desc">Kelas {meta.class_name}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Pertemuan Tercatat</div>
            <div className="stat-value text-2xl">{meta.meetings}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Rata-rata Kehadiran</div>
            <div className="stat-value text-primary">{avg}%</div>
            <div className="stat-desc">{data.length} siswa</div>
          </div>
        </div>
      ) : null}

      <div className="card overflow-hidden border border-base-300 bg-base-100">
        <DataTable
          table={table}
          emptyText={
            search.go
              ? "Tidak ada data ditemukan."
              : "Pilih kelas, mata pelajaran, dan rentang tanggal untuk menampilkan rekap."
          }
        />
        <Pager table={table} />
      </div>

      {/* Tanda tangan */}
      <div className="print-only mt-10 hidden">
        <div className="ml-auto w-64 text-center text-sm">
          <p>
            Mengetahui,
            <br />
            Kepala Sekolah
          </p>
          <p className="mt-16 font-semibold underline">
            {settings.principal_name || "\u00A0"}
          </p>
          {settings.principal_nip ? <p>NIP. {settings.principal_nip}</p> : null}
        </div>
      </div>
    </div>
  );
}
