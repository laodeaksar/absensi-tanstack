import { useConvexMutation } from "@convex-dev/react-query";
import { useForm, useSelector } from "@tanstack/react-form";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTable } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { GradeBook, GradeSemester } from "~/lib/types";

import {
  HeaderButton,
  PageHeader,
  PassStatusIcon,
} from "~/components/status-icons";
import {
  DataTable,
  ErrorAlert,
  Modal,
  PageSpinner,
  Pager,
  SelectField,
  TextField,
} from "~/components/ui";
import { api as convexApi } from "~/convex/_generated/api";
import { LIMITS } from "~/convex/limits";
import { allowRoles } from "~/lib/auth";
import {
  gradeConfigSchema,
  gradeFilterSchema,
  gradeScoresSchema,
  parseNum,
  parseScore,
} from "~/lib/grade-schema";
import { gradeBookQuery, settingsQuery, teachingQuery } from "~/lib/queries";
import { columnHelperFor, features } from "~/lib/table";
import { toast } from "~/lib/toast";
import { errorText } from "~/utils/form";

export const Route = createFileRoute("/_app/grades")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query(teachingQuery),
      context.queryClient.query(settingsQuery),
    ]),
  component: GradesPage,
});

type GradeRow = GradeBook["rows"][number];
type GradeComponentDef = GradeBook["config"]["components"][number];
type Scores = Record<string, Record<string, string>>;
type GradeBookArgs = {
  classId: string;
  subjectId: string;
  academicYear: string;
  semester: GradeSemester;
};

const col = columnHelperFor<GradeRow>();

function scoresOf(data: GradeBook): Scores {
  const out: Scores = {};
  for (const r of data.rows) {
    const cells: Record<string, string> = {};
    for (const c of data.config.components)
      if (c.source === "manual")
        cells[c.key] = r.values[c.key]?.toString() ?? "";
    out[r.student_id] = cells;
  }
  return out;
}

function useScoresForm(
  initial: Scores,
  onSubmit: (scores: Scores, reset: (scores: Scores) => void) => Promise<void>,
) {
  return useForm({
    defaultValues: { scores: initial },
    validators: { onChange: gradeScoresSchema, onSubmit: gradeScoresSchema },
    onSubmit: ({ value, formApi }) =>
      onSubmit(value.scores, (scores) => formApi.reset({ scores })),
  });
}
type ScoresForm = ReturnType<typeof useScoresForm>;

function GradesPage() {
  const { data: teaching } = useSuspenseQuery(teachingQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [cfgOpen, setCfgOpen] = useState(false);

  // Kelompokkan mapel per kelas sekali saja, bukan filter berulang tiap render.
  const subjectsByClass = useMemo(() => {
    const m = new Map<string, typeof teaching>();
    for (const t of teaching) {
      const list = m.get(t.class_id);
      if (list) list.push(t);
      else m.set(t.class_id, [t]);
    }
    return m;
  }, [teaching]);

  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teaching)
      if (!m.has(t.class_id)) m.set(t.class_id, t.class_name);
    return [...m];
  }, [teaching]);
  const subjectsOf = (classId: string) => subjectsByClass.get(classId) ?? [];
  // teaching.filter((t) => t.class_id === classId);
  // Hanya satu pilihan: langsung terisi
  const onlySubjectFor = (classId: string) => {
    const rows = subjectsOf(classId);
    return rows.length === 1 ? rows[0]!.subject_id : "";
  };

  const defaultClass = classes.length === 1 ? classes[0]![0] : "";
  const form = useForm({
    defaultValues: {
      classId: defaultClass,
      subjectId: onlySubjectFor(defaultClass),
      year: settings.active_academic_year ?? "",
      semester: settings.active_semester === "genap" ? "genap" : "ganjil",
    },
    validators: { onChange: gradeFilterSchema },
  });

  const values = useSelector(form.store, (s) => s.values);
  const parsed = gradeFilterSchema.safeParse(values);
  const args = parsed.success
    ? {
        classId: parsed.data.classId,
        subjectId: parsed.data.subjectId,
        academicYear: parsed.data.year,
        semester: parsed.data.semester as GradeSemester,
      }
    : null;
  const book = useQuery({
    ...gradeBookQuery(
      args ?? {
        classId: "",
        subjectId: "",
        academicYear: "",
        semester: "ganjil",
      },
    ),
    enabled: !!args,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Nilai">
        {book.data ? (
          <HeaderButton
            label="Pengaturan Nilai"
            className="btn-outline"
            icon={<Settings2 className="size-4" />}
            onClick={() => setCfgOpen(true)}
          />
        ) : null}
      </PageHeader>

      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="card border border-base-300 bg-base-100"
      >
        <div className="card-body grid grid-cols-1 items-start gap-4 p-5 md:grid-cols-4">
          <form.Field
            name="classId"
            listeners={{
              // Mapel bergantung pada kelas: pilihan lama tidak berlaku lagi
              onChange: ({ fieldApi }) =>
                fieldApi.form.setFieldValue(
                  "subjectId",
                  onlySubjectFor(fieldApi.state.value),
                  {
                    dontValidate: true,
                  },
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
                {classes.map(([id, name]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {name}
                  </option>
                ))}
              </SelectField>
            )}
          </form.Field>
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
                  {values.classId ? "-- Pilih --" : "-- Pilih kelas dulu --"}
                </option>
                {subjectsOf(values.classId).map((t) => (
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
        </div>
      </form>

      {!args ? (
        <p className="text-sm text-base-content/60">
          Pilih kelas, mata pelajaran, dan tahun ajaran untuk menampilkan nilai.
        </p>
      ) : book.isPending ? (
        <PageSpinner />
      ) : book.error ? (
        <ErrorAlert message={book.error.message} />
      ) : book.data ? (
        <GradeBookTable
          key={`${args.classId}|${args.subjectId}|${args.academicYear}|${args.semester}|${book.data.config.components
            .map((c) => c.key)
            .join(",")}`}
          args={args}
          data={book.data}
        />
      ) : null}

      <Modal
        open={cfgOpen}
        onClose={() => setCfgOpen(false)}
        title="Pengaturan Nilai"
      >
        {cfgOpen && book.data && args ? (
          <GradeConfigForm
            args={args}
            initial={book.data.config}
            onDone={() => setCfgOpen(false)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function GradeStudentCell({ row }: Readonly<{ row: GradeRow }>) {
  return (
    <div className="min-w-36">
      <div className="font-medium">{row.full_name}</div>
      <div className="text-xs text-base-content/60">{row.nis}</div>
    </div>
  );
}

function GradeComponentHeader({
  component,
}: Readonly<{ component: GradeComponentDef }>) {
  return (
    <div className="text-center">
      {component.label}
      <div className="text-xs font-normal text-base-content/60">
        {component.weight}% {component.source === "tugas" ? "(otomatis)" : ""}
      </div>
    </div>
  );
}

function GradeScoreCell({
  form,
  row,
  component,
}: Readonly<{
  form: ScoresForm;
  row: GradeRow;
  component: GradeComponentDef;
}>) {
  // Tugas dihitung otomatis dari nilai tugas; komponen manual diisi guru
  if (component.source === "tugas")
    return <>{row.values[component.key] ?? "-"}</>;

  return (
    <div className="w-28">
      <form.Field name={`scores.${row.student_id}.${component.key}`}>
        {(f) => (
          <TextField
            label=""
            aria-label={`${component.label} ${row.full_name}`}
            field={f}
            inputMode="decimal"
          />
        )}
      </form.Field>
    </div>
  );
}

function GradeFinalCell({ row }: Readonly<{ row: GradeRow }>) {
  if (row.final === null) return <>-</>;
  return (
    <span className="font-semibold">
      {row.final}
      {row.complete ? "" : "*"}
    </span>
  );
}

function GradeStatusCell({ row }: Readonly<{ row: GradeRow }>) {
  return row.final === null ? <>-</> : <PassStatusIcon passed={row.passed} />;
}

function createGradeColumns({
  components,
  form,
}: Readonly<{
  components: GradeComponentDef[];
  form: ScoresForm;
}>) {
  return col.columns([
    col.display({
      id: "student",
      header: "Nama",
      enableSorting: false,
      cell: ({ row }) => <GradeStudentCell row={row.original} />,
    }),
    // Satu kolom per komponen nilai sesuai pengaturan kelas dan mapel
    ...components.map((c) =>
      col.display({
        id: c.key,
        header: () => <GradeComponentHeader component={c} />,
        cell: ({ row }) => (
          <GradeScoreCell
            form={form}
            row={row.original}
            component={c}
          />
        ),
      }),
    ),
    col.display({
      id: "final",
      header: "Akhir",
      cell: ({ row }) => <GradeFinalCell row={row.original} />,
    }),
    col.display({
      id: "predicate",
      header: "Predikat",
      cell: ({ row }) => row.original.predicate || "-",
    }),
    col.display({
      id: "status",
      header: "Status",
      cell: ({ row }) => <GradeStatusCell row={row.original} />,
    }),
  ]);
}

function GradeBookTable({
  args,
  data,
}: Readonly<{
  args: GradeBookArgs;
  data: GradeBook;
}>) {
  const qc = useQueryClient();
  const [baseline, setBaseline] = useState<Scores>(() => scoresOf(data));
  const saveFn = useConvexMutation(convexApi.grades.saveScores);
  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success("Nilai tersimpan.");
      void qc.invalidateQueries({
        queryKey: gradeBookQuery(args).queryKey,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useScoresForm(baseline, async (scores, reset) => {
    // Kirim hanya sel yang berubah dari nilai tersimpan
    const entries: {
      studentId: string;
      component: string;
      score: number | null;
    }[] = [];
    for (const [studentId, cells] of Object.entries(scores))
      for (const [component, text] of Object.entries(cells))
        if (text.trim() !== (baseline[studentId]?.[component] ?? "").trim())
          entries.push({ studentId, component, score: parseScore(text) });
    if (!entries.length) return;
    try {
      await save.mutateAsync({ ...args, entries });
    } catch {
      return; // pesan error sudah ditampilkan lewat toast
    }
    setBaseline(scores);
    reset(scores); // nilai tersimpan jadi nilai awal, tombol Simpan kembali nonaktif
  });

  const columns = useMemo(
    () => createGradeColumns({ components: data.config.components, form }),
    [data.config.components, form],
  );

  const table = useTable({
    features,
    columns,
    data: data.rows,
    initialState: { pagination: { pageIndex: 0, pageSize: 100 } },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-base-content/60">
        KKM {data.config.kkm}
        {data.config.saved ? "" : " (bawaan, belum diatur)"}. {data.task_count}{" "}
        tugas terbit di semester ini; nilai tugas adalah rata-rata tugas yang
        sudah dinilai. Tanda * berarti nilai sementara karena ada komponen yang
        belum diisi.
      </p>
      <DataTable
        table={table}
        emptyText="Belum ada siswa di kelas ini."
      />
      <Pager table={table} />
      {save.error ? <ErrorAlert message={save.error.message} /> : null}
      <form.Subscribe
        selector={(s) => [s.isDefaultValue, s.isSubmitting] as const}
      >
        {([pristine, submitting]) => (
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pristine || submitting}
            >
              Simpan Nilai
            </button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function slugKey(label: string, taken: string[]) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 16) || "nilai";
  let k = base;
  let i = 2;
  while (taken.includes(k) || k === "tugas") k = `${base}_${i++}`;
  return k;
}

function GradeConfigForm({
  args,
  initial,
  onDone,
}: Readonly<{
  args: GradeBookArgs;
  initial: GradeBook["config"];
  onDone: () => void;
}>) {
  const qc = useQueryClient();
  const saveFn = useConvexMutation(convexApi.grades.saveGradeConfig);
  const save = useMutation({ mutationFn: saveFn });

  const form = useForm({
    defaultValues: {
      kkm: String(initial.kkm),
      components: initial.components.map((c) => ({
        key: c.key,
        label: c.label,
        weight: String(c.weight),
        source: c.source as string,
      })),
    },
    validators: { onChange: gradeConfigSchema, onSubmit: gradeConfigSchema },
    onSubmit: async ({ value }) => {
      const taken = value.components.filter((c) => c.key).map((c) => c.key);
      const components = value.components.map((c) => {
        const source =
          c.source === "tugas" ? ("tugas" as const) : ("manual" as const);
        let key = source === "tugas" ? "tugas" : c.key;
        if (!key) {
          key = slugKey(c.label, taken);
          taken.push(key);
        }
        return {
          key,
          label: c.label.trim(),
          weight: parseNum(c.weight),
          source,
        };
      });
      try {
        await save.mutateAsync({
          classId: args.classId,
          subjectId: args.subjectId,
          kkm: parseNum(value.kkm),
          components,
        });
      } catch {
        return; // pesan error tampil lewat ErrorAlert
      }
      await qc.invalidateQueries({
        queryKey: gradeBookQuery(args).queryKey,
      });
      toast.success("Pengaturan nilai tersimpan.");
      onDone();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="max-w-40">
        <form.Field name="kkm">
          {(f) => (
            <TextField
              label="KKM"
              field={f}
              inputMode="decimal"
            />
          )}
        </form.Field>
      </div>

      <form.Field
        name="components"
        mode="array"
      >
        {(arr) => (
          <div className="space-y-3">
            {arr.state.value.map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_6rem_10rem_auto]"
              >
                <form.Field name={`components[${i}].label`}>
                  {(f) => (
                    <TextField
                      label="Komponen"
                      field={f}
                      placeholder="UTS"
                    />
                  )}
                </form.Field>
                <form.Field name={`components[${i}].weight`}>
                  {(f) => (
                    <TextField
                      label="Bobot (%)"
                      field={f}
                      inputMode="decimal"
                    />
                  )}
                </form.Field>
                <form.Field name={`components[${i}].source`}>
                  {(f) => (
                    <SelectField
                      label="Sumber"
                      field={f}
                    >
                      <option value="manual">Input manual</option>
                      <option value="tugas">Tugas otomatis</option>
                    </SelectField>
                  )}
                </form.Field>
                <button
                  type="button"
                  className="btn btn-ghost sm:mt-7"
                  disabled={arr.state.value.length <= 1}
                  onClick={() => arr.removeValue(i)}
                >
                  Hapus
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={arr.state.value.length >= LIMITS.maxComponents}
              onClick={() =>
                arr.pushValue({
                  key: "",
                  label: "",
                  weight: "0",
                  source: "manual",
                })
              }
            >
              + Komponen
            </button>
            <ErrorAlert message={errorText(arr)} />
          </div>
        )}
      </form.Field>

      <ErrorAlert message={save.error?.message} />
      <div className="modal-action">
        <button
          type="button"
          className="btn"
          onClick={onDone}
        >
          Batal
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={save.isPending}
        >
          Simpan
        </button>
      </div>
    </form>
  );
}
