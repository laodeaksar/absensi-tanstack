import { useForm, useSelector } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { GradeSemester } from "~/lib/types";

import { PageHeader } from "~/components/status-icons";
import { SelectField, TextField } from "~/components/ui";
import { allowRoles } from "~/lib/auth";
import { gradePeriodSchema } from "~/lib/grade-schema";
import { myGradesQuery, settingsQuery } from "~/lib/queries";

export const Route = createFileRoute("/_app/my-grades")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  loader: ({ context }) => context.queryClient.query(settingsQuery),
  component: MyGradesPage,
});

function MyGradesPage() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const form = useForm({
    defaultValues: {
      year: settings.active_academic_year ?? "",
      semester: settings.active_semester === "genap" ? "genap" : "ganjil",
    },
    validators: { onChange: gradePeriodSchema },
  });
  const formValues = useSelector(form.store, (s) => s.values);
  const parsed = gradePeriodSchema.safeParse(formValues);

  return (
    <div className="space-y-4">
      <PageHeader title="Nilai Saya" />
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="grid max-w-md grid-cols-1 items-start gap-4 sm:grid-cols-2"
      >
        <form.Field name="year">
          {(f) => (
            <TextField
              label="Tahun Ajaran"
              field={f}
              placeholder="2025/2026"
            />
          )}
        </form.Field>
        <form.Field name="semester">
          {(f) => (
            <SelectField
              label="Semester"
              field={f}
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </SelectField>
          )}
        </form.Field>
      </form>
      {parsed.success ? (
        <Grades
          year={parsed.data.year}
          semester={parsed.data.semester as GradeSemester}
        />
      ) : null}
    </div>
  );
}

function Grades({
  year,
  semester,
}: Readonly<{ year: string; semester: GradeSemester }>) {
  const { data } = useSuspenseQuery(
    myGradesQuery({ academicYear: year, semester }),
  );
  if (!data.rows.length)
    return (
      <p className="text-sm text-base-content/60">
        Belum ada mata pelajaran di kelas Anda.
      </p>
    );
  return (
    <div className="space-y-3">
      {data.rows.map((r) => (
        <section
          key={r.subject_id}
          className="card bg-base-100 shadow-sm"
        >
          <div className="card-body gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{r.subject_name}</h2>
              {r.final === null ? (
                <span className="text-sm text-base-content/50">
                  Belum ada nilai
                </span>
              ) : (
                <span
                  className={`badge ${r.passed ? "badge-success" : "badge-error"}`}
                >
                  {r.final}
                  {r.complete ? "" : "*"} - {r.predicate} -{" "}
                  {r.passed ? "Tuntas" : "Belum tuntas"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {r.components.map((c) => (
                <span key={c.key}>
                  {c.label} ({c.weight}%): <b>{c.value ?? "-"}</b>
                </span>
              ))}
            </div>
            <div className="text-xs text-base-content/60">
              KKM {r.kkm}
              {r.final !== null && !r.complete ? " - * nilai sementara" : ""}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
