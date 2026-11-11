import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useMemo } from "react";

import { BackLink } from "~/components/back-link";
import { PageHeader } from "~/components/status-icons";
import { allowRoles } from "~/lib/auth";
import { formatDateTime } from "~/lib/date";
import {
  classesQuery,
  teacherAssignmentsQuery,
  teachersQuery,
  teachingQuery,
} from "~/lib/queries";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/teachers/$teacherId")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin"]),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query(teachersQuery),
      context.queryClient.query(classesQuery),
      context.queryClient.query(teachingQuery),
      context.queryClient.query(teacherAssignmentsQuery(params.teacherId)),
    ]),
  component: TeacherDetailPage,
});

function Info({
  label,
  children,
}: Readonly<{ label: string; children?: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-xs text-base-content/60">{label}</dt>
      <dd className="text-sm">
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
      <div className="card-body gap-3 p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function TeacherDetailPage() {
  const { teacherId } = Route.useParams();
  const { data: teachers } = useSuspenseQuery(teachersQuery);
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: rows } = useSuspenseQuery(teachingQuery);
  const { data: tasks } = useSuspenseQuery(teacherAssignmentsQuery(teacherId));

  const teacher = teachers.find((t) => t.user_id === teacherId);

  const classNames = useMemo(() => {
    const byId = new Map(
      classes.map((c) => [c.class_id, c.class_name] as const),
    );
    return (teacher?.assigned_classes ?? []).map((id) => byId.get(id) ?? id);
  }, [classes, teacher]);

  // Satu mapel bisa diampu di banyak kelas: kelompokkan per mapel
  const subjects = useMemo(() => {
    const m = new Map<
      string,
      {
        name: string;
        code: string;
        active: boolean;
        classes: { name: string; active: boolean }[];
      }
    >();
    for (const r of rows) {
      if (r.teacher_id !== teacherId) continue;
      const g = m.get(r.subject_id) ?? {
        name: r.subject_name,
        code: r.subject_code,
        active: r.subject_active,
        classes: [],
      };
      g.classes.push({ name: r.class_name, active: r.class_active });
      m.set(r.subject_id, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, teacherId]);

  if (!teacher)
    return (
      <div className="space-y-4">
        <BackLink to="/teachers" />
        <div
          role="alert"
          className="alert alert-warning alert-soft"
        >
          Guru tidak ditemukan.
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <BackLink to="/teachers" />
      <PageHeader
        title={teacher.full_name}
        subtitle={
          <p className="text-sm text-base-content/60">
            @{teacher.username}
            {isActive(teacher.is_active) ? "" : " - Nonaktif"}
          </p>
        }
      >
        <Link
          to="/teachers"
          search={{ edit: teacher.user_id }}
          aria-label="Edit"
          className="btn btn-primary btn-sm"
        >
          <Pencil className="size-4" />
          <span className="hidden sm:inline">Edit</span>
        </Link>
      </PageHeader>

      <Section title="Profil">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Nama Lengkap">{teacher.full_name}</Info>
          <Info label="Username">{teacher.username}</Info>
          <Info label="NIP">{teacher.nip}</Info>
          <Info label="Status">
            <span
              className={`badge badge-sm ${isActive(teacher.is_active) ? "badge-success" : "badge-ghost"}`}
            >
              {isActive(teacher.is_active) ? "Aktif" : "Nonaktif"}
            </span>
          </Info>
          <Info label="Telepon">{teacher.phone}</Info>
          <Info label="Email">{teacher.email}</Info>
        </dl>
      </Section>

      <Section title="Kelas yang diampu">
        {classNames.length ? (
          <div className="flex flex-wrap gap-1">
            {classNames.map((n) => (
              <span
                key={n}
                className="badge badge-ghost badge-sm"
              >
                {n}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-base-content/40">-</div>
        )}
      </Section>

      <Section title="Mata pelajaran yang diampu">
        {subjects.length ? (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li
                key={s.code + s.name}
                className="rounded-lg border border-base-300 p-2"
              >
                <div className="text-sm font-medium">
                  {s.code} - {s.name}
                  {s.active ? "" : " (nonaktif)"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.classes.map((c) => (
                    <span
                      key={c.name}
                      className="badge badge-ghost badge-sm"
                    >
                      {c.name}
                      {c.active ? "" : " (nonaktif)"}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-base-content/40">
            Belum mengampu mata pelajaran.
          </div>
        )}
      </Section>

      <Section title="Tugas">
        <p className="text-xs text-base-content/60">
          Dibuat guru ini atau berada di kelas dan mata pelajaran yang diampu.
        </p>
        {tasks.length ? (
          <ul className="divide-y divide-base-300 rounded-lg border border-base-300">
            {tasks.map((a) => (
              <li
                key={a.assignment_id}
                className="p-2"
              >
                <Link
                  to="/assignments/$assignmentId/questions"
                  params={{ assignmentId: a.assignment_id }}
                  className="link link-primary text-sm font-medium"
                >
                  {a.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-base-content/60">
                  <span>
                    {a.class_name}
                    {a.subject_name ? ` · ${a.subject_name}` : ""}
                  </span>
                  <span
                    className={`badge badge-xs ${a.is_published ? "badge-success" : "badge-ghost"}`}
                  >
                    {a.is_published ? "Terbit" : "Draf"}
                  </span>
                  {a.is_creator ? (
                    <span className="badge badge-xs badge-info badge-soft">
                      Dibuat guru ini
                    </span>
                  ) : (
                    <span>· Dibuat oleh {a.creator_name}</span>
                  )}
                  {a.due_at ? (
                    <span>· Tenggat {formatDateTime(a.due_at)}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-base-content/40">Belum ada tugas.</div>
        )}
      </Section>
    </div>
  );
}
