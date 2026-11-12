import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";

import { BackLink } from "~/components/back-link";
import { PageHeader } from "~/components/status-icons";
import { allowRoles } from "~/lib/auth";
import { formatDate } from "~/lib/date";
import { studentDetailQuery } from "~/lib/queries";

export const Route = createFileRoute("/_app/students/$studentId")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context, params }) =>
    context.queryClient.query(studentDetailQuery(params.studentId)),
  component: StudentDetailPage,
});

const STATUS_BADGE: Record<string, string> = {
  Hadir: "badge-success",
  Sakit: "badge-warning",
  Izin: "badge-info",
  Alpa: "badge-error",
};

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function Info({
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

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="card bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-3 p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

const Empty = ({ text }: Readonly<{ text: string }>) => (
  <div className="text-sm text-base-content/40">{text}</div>
);

function StudentDetailPage() {
  const { studentId } = Route.useParams();
  const { data } = useSuspenseQuery(studentDetailQuery(studentId));
  const { profile: p, classes, attendance, subjects, tasks } = data;
  const current = classes.find((c) => c.is_active);
  const sum = attendance.summary;

  return (
    <div className="space-y-4">
      <div>
        <BackLink to="/students" />
        <PageHeader
          title={p.full_name}
          subtitle={
            <p className="text-sm text-base-content/60">
              NIS {p.nis}
              {current ? ` - ${current.class_name}` : ""}
              {p.is_active ? "" : " - Nonaktif"}
            </p>
          }
        >
          {Route.useRouteContext().me.role === "admin" ? (
            <Link
              to="/students"
              search={{ edit: p.student_id, back: true }}
              aria-label="Edit"
              className="btn btn-primary btn-sm max-sm:btn-square"
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          ) : null}
        </PageHeader>
      </div>

      <Section title="Profil">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Nama Lengkap">{p.full_name}</Info>
          <Info label="NIS">{p.nis}</Info>
          <Info label="NISN">{p.nisn}</Info>
          <Info label="Jenis Kelamin">{p.gender}</Info>
          <Info label="Tempat, Tanggal Lahir">
            {[p.birth_place, p.birth_date ? formatDate(p.birth_date) : ""]
              .filter(Boolean)
              .join(", ")}
          </Info>
          <Info label="Status">
            <span
              className={`badge badge-sm ${p.is_active ? "badge-success" : "badge-ghost"}`}
            >
              {p.is_active ? "Aktif" : "Nonaktif"}
            </span>
          </Info>
          <Info label="Nama Orang Tua / Wali">{p.parent_name}</Info>
          <Info label="Telepon Orang Tua / Wali">{p.parent_phone}</Info>
          <div className="sm:col-span-2">
            <Info label="Alamat">{p.address}</Info>
          </div>
        </dl>
      </Section>

      <Section title="Riwayat kelas">
        {classes.length ? (
          <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
            {classes.map((c) => (
              <li
                key={c.class_name + c.start_date}
                className="flex flex-wrap items-center gap-2 p-2 text-sm"
              >
                <span className="font-medium">{c.class_name}</span>
                <span className="text-base-content/60">
                  {c.academic_year} -{" "}
                  {c.start_date ? formatDate(c.start_date) : "-"}
                  {c.end_date ? ` s.d. ${formatDate(c.end_date)}` : ""}
                </span>
                {c.is_active ? (
                  <span className="badge badge-xs badge-success">Saat ini</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Belum ada riwayat kelas." />
        )}
      </Section>

      <Section title="Kehadiran harian">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Hadir", sum.hadir],
              ["Sakit", sum.sakit],
              ["Izin", sum.izin],
              ["Alpa", sum.alpa],
              ["Persentase", `${sum.persentase}%`],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-base-300 p-2 text-center"
            >
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-xs text-base-content/60">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-base-content/60">
          Dihitung dari maksimal 500 catatan terbaru. Berikut 15 catatan
          terakhir.
        </p>
        {attendance.recent.length ? (
          <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
            {attendance.recent.map((r) => (
              <li
                key={r.date + r.class_name}
                className="flex flex-wrap items-center gap-2 p-2 text-sm"
              >
                <span>{formatDate(r.date)}</span>
                <span
                  className={`badge badge-sm ${STATUS_BADGE[r.status] ?? "badge-ghost"}`}
                >
                  {r.status}
                </span>
                <span className="text-xs text-base-content/60">
                  {r.class_name}
                </span>
                {r.notes ? (
                  <span className="min-w-0 text-xs wrap-anywhere">
                    {r.notes}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Belum ada catatan kehadiran." />
        )}
      </Section>

      <Section title="Kehadiran per mata pelajaran">
        {subjects.length ? (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Mata Pelajaran</th>
                  <th className="text-center">H</th>
                  <th className="text-center">S</th>
                  <th className="text-center">I</th>
                  <th className="text-center">A</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.subject_name}>
                    <td>{s.subject_name}</td>
                    <td className="text-center">{s.hadir}</td>
                    <td className="text-center">{s.sakit}</td>
                    <td className="text-center">{s.izin}</td>
                    <td className="text-center">{s.alpa}</td>
                    <td className="text-right">{s.persentase}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Belum ada kehadiran per mata pelajaran." />
        )}
      </Section>

      <Section title="Tugas">
        {tasks.length ? (
          <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
            {tasks.map((t) => (
              <li
                key={t.assignment_id}
                className="p-2"
              >
                <Link
                  to="/assignments/$assignmentId/submissions"
                  params={{ assignmentId: t.assignment_id }}
                  className="link link-primary text-sm font-medium wrap-anywhere"
                >
                  {t.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-base-content/60">
                  <span>
                    {t.class_name}
                    {t.subject_name ? ` · ${t.subject_name}` : ""}
                  </span>
                  <span
                    className={`badge badge-xs ${
                      t.status === "dinilai"
                        ? "badge-success"
                        : t.status === "diserahkan"
                          ? "badge-info"
                          : "badge-warning"
                    }`}
                  >
                    {t.status === "dinilai"
                      ? "Dinilai"
                      : t.status === "diserahkan"
                        ? "Diserahkan"
                        : "Berlangsung"}
                  </span>
                  {t.status === "dinilai" && t.total_score !== null ? (
                    <span className="font-medium">
                      Nilai {t.total_score}/{t.max_score}
                    </span>
                  ) : null}
                  <span>· Mulai {fmtTime(t.started_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Belum ada tugas yang dikerjakan." />
        )}
      </Section>
    </div>
  );
}
