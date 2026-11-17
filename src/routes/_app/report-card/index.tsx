import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";

import type { GradeSemester, ReportCard } from "~/lib/types";

import { allowRoles } from "~/lib/auth";
import { formatDate } from "~/lib/date";
import { reportCardQuery } from "~/lib/queries";

export const Route = createFileRoute("/_app/report-card/")({
  beforeLoad: ({ context }) =>
    allowRoles(context.me, ["admin", "guru", "siswa"]),
  validateSearch: (s: Record<string, unknown>) => ({
    siswa: typeof s.siswa === "string" ? s.siswa : undefined,
    tahun: typeof s.tahun === "string" ? s.tahun : "",
    semester: (s.semester === "genap" ? "genap" : "ganjil") as GradeSemester,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.query(
      reportCardQuery({
        studentId: deps.siswa,
        academicYear: deps.tahun,
        semester: deps.semester,
      }),
    ),
  component: ReportCardPage,
});

function noteOf(r: ReportCard["rows"][number]) {
  if (!r.complete) return "Belum lengkap";
  return r.passed ? "Tuntas" : "Belum tuntas";
}

const cell = "border border-black px-2 py-1";

function ReportCardPage() {
  const search = Route.useSearch();
  const { data: card } = useSuspenseQuery(
    reportCardQuery({
      studentId: search.siswa,
      academicYear: search.tahun,
      semester: search.semester,
    }),
  );

  const finals = card.rows
    .map((r) => r.final)
    .filter((n): n is number => n !== null);
  const average = finals.length
    ? Math.round((finals.reduce((s, n) => s + n, 0) / finals.length) * 10) / 10
    : null;
  const incomplete = card.rows.some((r) => !r.complete);
  const semesterLabel = card.semester === "genap" ? "Genap" : "Ganjil";

  return (
    <div className="space-y-4">
      <style>
        {"@media print { @page { size: A4 portrait; margin: 14mm; } }"}
      </style>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => window.history.back()}
        >
          Kembali
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => window.print()}
        >
          <Printer className="size-4" /> Cetak / Simpan PDF
        </button>
      </div>

      {incomplete ? (
        <div
          role="alert"
          className="alert alert-warning no-print"
        >
          <span>
            Ada mata pelajaran yang nilainya belum lengkap. Rapor memuat nilai
            sementara (tanda *).
          </span>
        </div>
      ) : null}
      {card.school.principal_name ? null : (
        <div
          role="alert"
          className="alert alert-info no-print"
        >
          <span>
            Nama kepala sekolah belum diisi di Pengaturan, sehingga kolom tanda
            tangan dibiarkan kosong.
          </span>
        </div>
      )}

      <article className="mx-auto w-full max-w-[210mm] overflow-x-auto bg-white p-6 text-sm text-black shadow sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-4 border-double border-black pb-3 text-center">
          <h1 className="text-lg font-bold uppercase">{card.school.name}</h1>
          {card.school.address ? <p>{card.school.address}</p> : null}
        </header>

        <div className="my-4 text-center">
          <h2 className="text-base font-bold uppercase">
            Laporan Hasil Belajar (Rapor)
          </h2>
          <p>
            Semester {semesterLabel} Tahun Ajaran {card.academicYear}
          </p>
        </div>

        <table className="mb-4 w-full">
          <tbody>
            <tr>
              <td className="w-32 py-0.5">Nama Siswa</td>
              <td className="py-0.5">: {card.student.full_name}</td>
              <td className="w-24 py-0.5">Kelas</td>
              <td className="py-0.5">: {card.class.class_name}</td>
            </tr>
            <tr>
              <td className="py-0.5">NIS / NISN</td>
              <td className="py-0.5">
                : {card.student.nis || "-"} / {card.student.nisn || "-"}
              </td>
              <td className="py-0.5">Tingkat</td>
              <td className="py-0.5">: {card.class.grade_level || "-"}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-center">
              <th className={cell}>No</th>
              <th className={`${cell} text-left`}>Mata Pelajaran</th>
              <th className={cell}>KKM</th>
              <th className={cell}>Nilai Akhir</th>
              <th className={cell}>Predikat</th>
              <th className={cell}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.length ? (
              card.rows.map((r, i) => (
                <tr key={r.subject_id}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={cell}>{r.subject_name}</td>
                  <td className={`${cell} text-center`}>{r.kkm}</td>
                  <td className={`${cell} text-center font-semibold`}>
                    {r.final ?? "-"}
                    {r.complete ? "" : "*"}
                  </td>
                  <td className={`${cell} text-center`}>
                    {r.predicate || "-"}
                  </td>
                  <td className={`${cell} text-center`}>{noteOf(r)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className={`${cell} text-center`}
                >
                  Belum ada mata pelajaran pada kelas ini.
                </td>
              </tr>
            )}
          </tbody>
          {average !== null ? (
            <tfoot>
              <tr className="font-semibold">
                <td
                  colSpan={3}
                  className={`${cell} text-right`}
                >
                  Rata-rata
                </td>
                <td className={`${cell} text-center`}>{average}</td>
                <td
                  colSpan={2}
                  className={cell}
                />
              </tr>
            </tfoot>
          ) : null}
        </table>
        {incomplete ? (
          <p className="mt-1 text-xs">
            * Nilai sementara (komponen belum lengkap).
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-2 gap-8 text-center">
          <div>
            <p className="invisible">.</p>
            <p>Wali Kelas</p>
            <div className="h-20" />
            <p className="font-semibold underline">
              {card.homeroom?.name || "...................................."}
            </p>
            {card.homeroom?.nip ? <p>NIP. {card.homeroom.nip}</p> : null}
          </div>
          <div>
            <p>{formatDate(card.printed_at)}</p>
            <p>Kepala Sekolah</p>
            <div className="h-20" />
            <p className="font-semibold underline">
              {card.school.principal_name ||
                "...................................."}
            </p>
            {card.school.principal_nip ? (
              <p>NIP. {card.school.principal_nip}</p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
