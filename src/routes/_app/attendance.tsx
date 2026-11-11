import { useForm } from "@tanstack/react-form";
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { AttendanceGrid } from "~/components/attendance-grid";
import {
  ErrorAlert,
  PageSpinner,
  SelectField,
  TextField,
} from "~/components/ui";
import { api } from "~/lib/api";
import {
  DAILY_SUBJECT,
  earliestDate,
  makeSplitFilterSchema,
  parseTarget,
  subjectValue,
  targetKey,
} from "~/lib/attendance-schema";
import { allowRoles } from "~/lib/auth";
import { todayStr } from "~/lib/date";
import {
  attendanceFormQuery,
  classesQuery,
  qk,
  settingsQuery,
  teachingQuery,
} from "~/lib/queries";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/attendance")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === "string" ? s.date : undefined,
    classId: typeof s.classId === "string" ? s.classId : undefined,
    // diisi bila yang dipilih absensi mata pelajaran
    subjectId: typeof s.subjectId === "string" ? s.subjectId : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(classesQuery),
      context.queryClient.query(settingsQuery),
      context.queryClient.query(teachingQuery),
    ]),
  component: AttendancePage,
});

function AttendancePage() {
  const { me } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: classes } = useSuspenseQuery(classesQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  // Guru: pengampu miliknya. Admin: semua pengampu yang terdaftar.
  const { data: teaching } = useSuspenseQuery(teachingQuery);

  // Aturan dinamis: bergantung peran, kelas yang diampu, dan pengaturan jendela edit
  const restricted = me.role !== "admin";
  const editWindowDays = Number(settings.edit_window_days) || 0;
  // "Hari ini" mengikuti zona waktu sekolah (sama dengan server), bukan jam perangkat
  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  // Absensi harian: kelas yang diampu (guru) atau semua kelas aktif (admin)
  const dailyOptions = useMemo(() => {
    const mine = me.role === "guru" ? me.assigned_classes : null;
    return classes.filter(
      (c) => isActive(c.is_active) && (!mine || mine.includes(c.class_id)),
    );
  }, [classes, me.role, me.assigned_classes]);

  // Absensi mata pelajaran: pasangan kelas + mapel yang keduanya masih aktif
  const subjectOptions = useMemo(
    () => teaching.filter((t) => t.class_active && t.subject_active),
    [teaching],
  );

  // Kelas yang bisa dipilih: kelas absensi harian + kelas tempat ia mengampu mata pelajaran
  const classChoices = useMemo(() => {
    const ids = new Set([
      ...dailyOptions.map((c) => c.class_id),
      ...subjectOptions.map((t) => t.class_id),
    ]);
    return classes.filter((c) => ids.has(c.class_id));
  }, [classes, dailyOptions, subjectOptions]);

  const targets = useMemo(
    () => [
      ...dailyOptions.map((c) => targetKey(c.class_id)),
      ...subjectOptions.map((t) => targetKey(t.class_id, t.subject_id)),
    ],
    [dailyOptions, subjectOptions],
  );

  const rules = useMemo(
    () => ({ restricted, editWindowDays, tzOffsetMinutes: tz }),
    [restricted, editWindowDays, tz],
  );
  const filterSchema = useMemo(
    () => makeSplitFilterSchema({ targets, ...rules }),
    [targets, rules],
  );
  const minDate = earliestDate(rules);

  // Pilihan mata pelajaran untuk satu kelas: absensi harian (bila boleh) + mapel yang diampu
  const subjectValuesFor = (classId: string) => [
    ...(dailyOptions.some((c) => c.class_id === classId)
      ? [DAILY_SUBJECT]
      : []),
    ...subjectOptions
      .filter((t) => t.class_id === classId)
      .map((t) => t.subject_id),
  ];
  // Hanya satu pilihan = langsung terisi, tidak perlu memilih lagi
  const onlySubjectFor = (classId: string) => {
    const v = subjectValuesFor(classId);
    return v.length === 1 ? v[0]! : "";
  };
  const defaultClassId =
    search.classId ??
    (classChoices.length === 1 ? classChoices[0]!.class_id : "");

  const form = useForm({
    defaultValues: {
      date: search.date ?? todayStr(tz),
      classId: defaultClassId,
      subjectId: search.classId
        ? subjectValue(search.subjectId)
        : onlySubjectFor(defaultClassId),
    },
    validators: {
      onChange: filterSchema,
      onSubmit: filterSchema,
    },
    onSubmit: ({ value }) => {
      void qc.invalidateQueries({ queryKey: qk.attendance });
      void qc.invalidateQueries({ queryKey: qk.subjectAttendance });
      const t = parseTarget(value);
      void navigate({
        to: "/attendance",
        search: {
          date: value.date,
          classId: t.classId,
          subjectId: t.subjectId,
        },
      });
    },
  });

  // Parameter URL divalidasi dengan aturan yang sama (URL bisa diubah manual)
  const urlCheck = useMemo(
    () =>
      search.date || search.classId
        ? filterSchema.safeParse({
            date: search.date ?? "",
            classId: search.classId ?? "",
            subjectId: search.classId ? subjectValue(search.subjectId) : "",
          })
        : null,
    [filterSchema, search.date, search.classId, search.subjectId],
  );
  const picked = urlCheck?.success ? parseTarget(urlCheck.data) : null;
  const pickedSubject = picked?.subjectId
    ? subjectOptions.find(
        (t) =>
          t.class_id === picked.classId && t.subject_id === picked.subjectId,
      )
    : undefined;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Input Absensi</h2>

      <div className="card border border-base-300 bg-base-100">
        <form
          noValidate
          className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-4"
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
          <form.Field
            name="classId"
            listeners={{
              // Mata pelajaran bergantung pada kelas: pilihan lama tidak berlaku lagi,
              // dan bila kelas itu hanya punya satu pilihan, langsung terisi
              onChange: ({ fieldApi }) =>
                fieldApi.form.setFieldValue(
                  "subjectId",
                  onlySubjectFor(fieldApi.state.value),
                  { dontValidate: true },
                ),
            }}
          >
            {(f) => (
              <SelectField
                label="Kelas"
                field={f}
              >
                <option
                  disabled
                  value=""
                >
                  -- Pilih kelas --
                </option>
                {classChoices.map((c) => (
                  <option
                    key={c.class_id}
                    value={c.class_id}
                  >
                    {c.class_name}
                  </option>
                ))}
              </SelectField>
            )}
          </form.Field>
          <form.Subscribe selector={(st) => st.values.classId}>
            {(classId) => (
              <form.Field name="subjectId">
                {(f) => (
                  <SelectField
                    label="Mata Pelajaran"
                    field={f}
                  >
                    <option
                      disabled
                      value=""
                    >
                      {classId ? "-- Pilih --" : "-- Pilih kelas dulu --"}
                    </option>
                    {dailyOptions.some((c) => c.class_id === classId) ? (
                      <option value={DAILY_SUBJECT}>
                        Absensi Harian (tanpa mata pelajaran)
                      </option>
                    ) : null}
                    {subjectOptions
                      .filter((t) => t.class_id === classId)
                      .map((t) => (
                        <option
                          key={t.teaching_id}
                          value={t.subject_id}
                        >
                          {t.subject_name}
                        </option>
                      ))}
                  </SelectField>
                )}
              </form.Field>
            )}
          </form.Subscribe>
          {targets.length === 0 ? (
            <p className="text-warning text-sm md:col-span-full">
              {me.role === "guru"
                ? "Anda belum mengampu kelas atau mata pelajaran. Hubungi admin untuk mengaturnya."
                : "Belum ada kelas aktif atau pengampu mata pelajaran. Atur di menu Data Kelas dan Pengampu Mapel."}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-neutral mt-6 w-full"
            disabled={targets.length === 0}
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
          {pickedSubject ? (
            <p className="text-sm text-base-content/70">
              {pickedSubject.subject_name} · {pickedSubject.class_name} ·
              Pengampu: {pickedSubject.teacher_name}
            </p>
          ) : null}
          <AttendanceSection
            date={urlCheck.data.date}
            classId={picked.classId}
            subjectId={picked.subjectId}
          />
        </>
      ) : null}
    </div>
  );
}

function AttendanceSection({
  date,
  classId,
  subjectId,
}: Readonly<{
  date: string;
  classId: string;
  subjectId?: string;
}>) {
  const q = useQuery(attendanceFormQuery(date, classId, subjectId));
  const qc = useQueryClient();

  if (q.isPending) return <PageSpinner />;
  if (q.error) return <ErrorAlert message={q.error.message} />;

  return (
    <AttendanceGrid
      key={`${date}|${classId}|${subjectId ?? ""}|${q.dataUpdatedAt}`}
      entries={q.data}
      save={(payload) =>
        subjectId
          ? api.submitSubjectAttendance(date, classId, subjectId, payload)
          : api.submitAttendance(date, classId, payload)
      }
      onSaved={() => {
        if (subjectId) {
          void qc.invalidateQueries({ queryKey: qk.subjectAttendance });
          void qc.invalidateQueries({ queryKey: qk.subjectReport });
          void qc.invalidateQueries({ queryKey: qk.mySubjectAttendance });
        } else {
          void qc.invalidateQueries({ queryKey: qk.attendance });
          void qc.invalidateQueries({ queryKey: qk.dashboard });
          void qc.invalidateQueries({ queryKey: qk.report });
        }
      }}
    />
  );
}
