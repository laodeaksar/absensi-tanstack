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
import { earliestDate, makeFilterSchema } from "~/lib/attendance-schema";
import { allowRoles } from "~/lib/auth";
import { todayStr } from "~/lib/date";
import {
  attendanceFormQuery,
  classesQuery,
  qk,
  settingsQuery,
} from "~/lib/queries";
import { isActive } from "~/lib/types";

export const Route = createFileRoute("/_app/attendance")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === "string" ? s.date : undefined,
    classId: typeof s.classId === "string" ? s.classId : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(classesQuery),
      context.queryClient.query(settingsQuery),
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

  // Aturan dinamis: bergantung peran, kelas yang diampu, dan pengaturan jendela edit
  const restricted = me.role !== "admin";
  const editWindowDays = Number(settings.edit_window_days) || 0;
  // "Hari ini" mengikuti zona waktu sekolah (sama dengan server), bukan jam perangkat
  const tzRaw = settings.tz_offset_minutes;
  const tz =
    tzRaw !== "" && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;

  const options = useMemo(() => {
    const mine = me.role === "guru" ? me.assigned_classes : null;
    return classes.filter(
      (c) => isActive(c.is_active) && (!mine || mine.includes(c.class_id)),
    );
  }, [classes, me.role, me.assigned_classes]);

  const rules = useMemo(
    () => ({
      classIds: options.map((c) => c.class_id),
      restricted,
      editWindowDays,
      tzOffsetMinutes: tz,
    }),
    [options, restricted, editWindowDays, tz],
  );
  const filterSchema = useMemo(() => makeFilterSchema(rules), [rules]);
  const minDate = earliestDate(rules);

  const form = useForm({
    defaultValues: {
      date: search.date ?? todayStr(tz),
      classId: search.classId ?? "",
    },
    validators: {
      onChange: filterSchema,
      onSubmit: filterSchema,
    },
    onSubmit: ({ value }) => {
      void qc.invalidateQueries({
        queryKey: qk.attendance,
      });
      void navigate({
        to: "/attendance",
        search: {
          date: value.date,
          classId: value.classId,
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
          })
        : null,
    [filterSchema, search.date, search.classId],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Input Absensi</h2>

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
          <form.Field name="classId">
            {(f) => (
              <SelectField
                label="Kelas"
                field={f}
              >
                <option
                  disabled
                  value=""
                >
                  -- Pilih Kelas --
                </option>
                {options.map((c) => (
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
          {options.length === 0 ? (
            <p className="text-warning text-sm md:col-span-full">
              {me.role === "guru"
                ? "Anda belum mengampu kelas aktif. Hubungi admin untuk menambahkan kelas."
                : "Belum ada kelas aktif. Tambahkan kelas terlebih dahulu."}
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
      {urlCheck?.success ? (
        <AttendanceSection
          date={urlCheck.data.date}
          classId={urlCheck.data.classId}
        />
      ) : null}
    </div>
  );
}

function AttendanceSection({
  date,
  classId,
}: Readonly<{ date: string; classId: string }>) {
  const q = useQuery(attendanceFormQuery(date, classId));
  if (q.isPending) return <PageSpinner />;
  if (q.error) return <ErrorAlert message={q.error.message} />;
  // dataUpdatedAt: form dimuat ulang dengan data server setelah penyimpanan
  return (
    <AttendanceForm
      key={`${date}|${classId}|${q.dataUpdatedAt}`}
      date={date}
      classId={classId}
      entries={q.data}
    />
  );
}

function AttendanceForm({
  date,
  classId,
  entries,
}: Readonly<{
  date: string;
  classId: string;
  entries: AttendanceEntry[];
}>) {
  const qc = useQueryClient();
  return (
    <AttendanceGrid
      entries={entries}
      save={(payload) => api.submitAttendance(date, classId, payload)}
      onSaved={() => {
        void qc.invalidateQueries({ queryKey: qk.attendance });
        void qc.invalidateQueries({ queryKey: qk.dashboard });
        void qc.invalidateQueries({ queryKey: qk.report });
      }}
    />
  );
}