import { useForm } from "@tanstack/react-form";
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import type { AttendanceEntry } from "~/lib/types";

import { AttendanceGrid } from "~/components/attendance-grid";
import {
  ErrorAlert,
  PageSpinner,
  SelectField,
  TextField,
} from "~/components/ui";
import { api } from "~/lib/api";
import { earliestDate } from "~/lib/attendance-schema";
import { allowRoles } from "~/lib/auth";
import { todayStr } from "~/lib/date";
import {
  qk,
  settingsQuery,
  subjectAttendanceFormQuery,
  teachingQuery,
} from "~/lib/queries";
import {
  makeSubjectFilterSchema,
  pairKey,
  parsePair,
} from "~/lib/subject-attendance-schema";

export const Route = createFileRoute("/_app/subject-attendance")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === "string" ? s.date : undefined,
    pair: typeof s.pair === "string" ? s.pair : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(teachingQuery),
      context.queryClient.query(settingsQuery),
    ]),
  component: SubjectAttendancePage,
});

function SubjectAttendancePage() {
  const { me } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Guru: hanya pengampu miliknya. Admin: semua pengampu yang terdaftar.
  const { data: teaching } = useSuspenseQuery(teachingQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  // Aturan tanggal sama dengan absensi harian: guru tidak boleh masa depan dan dibatasi jendela edit
  const restricted = me.role !== "admin";
  const editWindowDays = Number(settings.edit_window_days) || 0;
  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  // Hanya pasangan kelas + mapel yang keduanya masih aktif
  const options = useMemo(
    () => teaching.filter((t) => t.class_active && t.subject_active),
    [teaching],
  );

  const rules = useMemo(
    () => ({
      pairs: options.map((t) => pairKey(t.class_id, t.subject_id)),
      restricted,
      editWindowDays,
      tzOffsetMinutes: tz,
    }),
    [options, restricted, editWindowDays, tz],
  );
  const filterSchema = useMemo(() => makeSubjectFilterSchema(rules), [rules]);
  const minDate = earliestDate(rules);

  const form = useForm({
    defaultValues: {
      date: search.date ?? todayStr(tz),
      pair: search.pair ?? "",
    },
    validators: { onChange: filterSchema, onSubmit: filterSchema },
    onSubmit: ({ value }) => {
      void qc.invalidateQueries({ queryKey: qk.subjectAttendance });
      void navigate({
        to: "/subject-attendance",
        search: { date: value.date, pair: value.pair },
      });
    },
  });

  // Parameter URL divalidasi dengan aturan yang sama (URL bisa diubah manual)
  const urlCheck = useMemo(
    () =>
      search.date || search.pair
        ? filterSchema.safeParse({
            date: search.date ?? "",
            pair: search.pair ?? "",
          })
        : null,
    [filterSchema, search.date, search.pair],
  );

  const picked = urlCheck?.success ? parsePair(urlCheck.data.pair) : null;
  const pickedRow = picked
    ? options.find(
        (t) =>
          t.class_id === picked.classId && t.subject_id === picked.subjectId,
      )
    : undefined;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Input Absensi Mata Pelajaran</h2>

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
          <form.Field name="date">
            {(f) => (
              <TextField
                label="Tanggal"
                field={f}
                type="date"
                max={restricted ? todayStr(tz) : undefined}
                min={minDate}
                hint={
                  restricted && editWindowDays > 0
                    ? `Maksimal ${editWindowDays} hari ke belakang.`
                    : undefined
                }
              />
            )}
          </form.Field>
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
          {options.length === 0 ? (
            <p className="text-warning text-sm md:col-span-full">
              {me.role === "guru"
                ? "Anda belum menjadi guru pengampu mata pelajaran mana pun. Hubungi admin untuk mengaturnya."
                : "Belum ada guru pengampu. Atur dulu di menu Pengampu Mapel."}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-neutral mt-6 w-full"
            disabled={options.length === 0}
          >
            Tampilkan Daftar Siswa
          </button>
        </form>
      </div>

      {urlCheck && !urlCheck.success ? (
        <ErrorAlert message={urlCheck.error.issues[0]?.message} />
      ) : null}
      {urlCheck?.success && picked ? (
        <>
          {pickedRow ? (
            <p className="text-sm text-base-content/70">
              {pickedRow.subject_name} · {pickedRow.class_name} · Pengampu:{" "}
              {pickedRow.teacher_name}
            </p>
          ) : null}
          <SubjectAttendanceSection
            date={urlCheck.data.date}
            classId={picked.classId}
            subjectId={picked.subjectId}
          />
        </>
      ) : null}
    </div>
  );
}

function SubjectAttendanceSection({
  date,
  classId,
  subjectId,
}: Readonly<{ date: string; classId: string; subjectId: string }>) {
  const q = useQuery(subjectAttendanceFormQuery(date, classId, subjectId));
  if (q.isPending) return <PageSpinner />;
  if (q.error) return <ErrorAlert message={q.error.message} />;
  // dataUpdatedAt: form dimuat ulang dengan data server setelah penyimpanan
  return (
    <SubjectAttendanceForm
      key={`${date}|${classId}|${subjectId}|${q.dataUpdatedAt}`}
      date={date}
      classId={classId}
      subjectId={subjectId}
      entries={q.data}
    />
  );
}

function SubjectAttendanceForm({
  date,
  classId,
  subjectId,
  entries,
}: Readonly<{
  date: string;
  classId: string;
  subjectId: string;
  entries: AttendanceEntry[];
}>) {
  const qc = useQueryClient();
  return (
    <AttendanceGrid
      entries={entries}
      save={(payload) =>
        api.submitSubjectAttendance(date, classId, subjectId, payload)
      }
      onSaved={() => {
        void qc.invalidateQueries({ queryKey: qk.subjectAttendance });
        void qc.invalidateQueries({ queryKey: qk.subjectReport });
      }}
    />
  );
}
