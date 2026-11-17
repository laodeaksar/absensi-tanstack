Impor massal dibuat dengan satu modal CSV yang bisa dipakai ulang, plus dua mutation di server. Belum diuji. Halaman guru masih menunggu file route-nya.

**1. `src/lib/csv.ts`, tambahkan parser:**

```ts
/** Parser CSV (RFC 4180). Pemisah , atau ; dideteksi dari baris header. Baris kosong dilewati. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const head = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else field += c;
  }
  endRow();
  return rows;
}
```

**2. `types.ts`:**

```ts
export interface ImportResult {
  created: number;
  failed: { line: number; reason: string }[];
}
```

**3. Modal reusable `src/components/csv-import-modal.tsx`:**

```tsx
import type { ReactNode } from "react";

import { useState } from "react";

import type { ImportResult } from "~/lib/types";

import { ErrorAlert, Modal } from "~/components/ui";
import { downloadCsv, parseCsv } from "~/lib/csv";

export type ImportField = {
  /** Nama kolom di berkas CSV, juga nama properti yang dikirim ke server. */
  key: string;
  label: string;
  required?: boolean;
  example: string;
  /** Angka yang harus tetap teks di Excel (NIS, NISN, NIP, nomor HP). */
  text?: boolean;
};

const MAX_ROWS = 1000;
const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/\s+/g, "_");
// Sel hasil ekspor kita berbentuk ="0123"
const cleanCell = (v: string) =>
  v
    .trim()
    .replace(/^="(.*)"$/, "$1")
    .trim();

type Row = Record<string, string | number>;

export function CsvImportModal({
  open,
  onClose,
  title,
  templateName,
  fields,
  chunkSize,
  send,
  canImport = true,
  extra,
  onFinished,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  templateName: string;
  fields: ImportField[];
  /** Jumlah baris per permintaan ke server. */
  chunkSize: number;
  send: (rows: Row[]) => Promise<ImportResult>;
  canImport?: boolean;
  extra?: ReactNode;
  onFinished?: () => void;
}>) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName("");
    setRows([]);
    setError("");
    setProgress(null);
    setResult(null);
  };
  const close = () => {
    if (progress !== null) return;
    reset();
    onClose();
  };

  const downloadTemplate = () =>
    downloadCsv<unknown>(
      `template-${templateName}.csv`,
      fields.map((f) => ({
        header: f.key,
        value: () => f.example,
        text: f.text,
      })),
      [undefined],
    );

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2_000_000) return setError("Ukuran berkas maksimal 2 MB.");

    const table = parseCsv(await file.text());
    if (table.length < 2)
      return setError("Berkas kosong atau hanya berisi baris header.");
    const header = table[0].map(normalizeHeader);
    const missing = fields.filter((f) => f.required && !header.includes(f.key));
    if (missing.length)
      return setError(
        `Kolom wajib tidak ditemukan: ${missing.map((f) => f.key).join(", ")}. Gunakan template dari tombol di bawah.`,
      );
    const data = table.slice(1);
    if (data.length > MAX_ROWS)
      return setError(`Maksimal ${MAX_ROWS} baris per berkas.`);

    const index = new Map(header.map((h, i) => [h, i]));
    setRows(
      data.map((r, n) => {
        const o: Row = { line: n + 1 };
        for (const f of fields)
          o[f.key] = cleanCell(r[index.get(f.key) ?? -1] ?? "");
        return o;
      }),
    );
  }

  async function run() {
    setError("");
    setProgress(0);
    const total: ImportResult = { created: 0, failed: [] };
    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const part = await send(rows.slice(i, i + chunkSize));
        total.created += part.created;
        total.failed.push(...part.failed);
        setProgress(Math.min(i + chunkSize, rows.length));
      }
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Impor terhenti."} Baris sebelumnya sudah tersimpan. Impor ulang aman, data yang sudah ada akan dilewati.`,
      );
    }
    setResult(total);
    setProgress(null);
    onFinished?.();
  }

  const running = progress !== null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
    >
      {result ? (
        <div className="space-y-3">
          <div className="alert alert-success">
            <span>
              {result.created} data berhasil diimpor
              {result.failed.length
                ? `, ${result.failed.length} baris dilewati.`
                : "."}
            </span>
          </div>
          <ErrorAlert message={error} />
          {result.failed.length ? (
            <>
              <div className="max-h-60 overflow-auto rounded-box border border-base-300">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f) => (
                      <tr key={`${f.line}-${f.reason}`}>
                        <td>{f.line}</td>
                        <td>{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() =>
                  downloadCsv(
                    `laporan-gagal-${templateName}.csv`,
                    [
                      { header: "Baris", value: (r) => r.line },
                      { header: "Alasan", value: (r) => r.reason },
                    ],
                    result.failed,
                  )
                }
              >
                Unduh laporan baris yang dilewati
              </button>
            </>
          ) : null}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-primary"
              onClick={close}
            >
              Selesai
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-base-content/70">
            Unggah berkas CSV sesuai template. Baris pertama adalah header.
            Nomor baris pada laporan dihitung dari baris data pertama.
          </p>
          <ul className="space-y-0.5 text-xs text-base-content/60">
            {fields.map((f) => (
              <li key={f.key}>
                <code>{f.key}</code> - {f.label}
                {f.required ? " (wajib)" : ""}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={downloadTemplate}
          >
            Unduh template
          </button>
          {extra}
          <input
            type="file"
            accept=".csv,text/csv"
            className="file-input w-full"
            aria-label="Berkas CSV"
            disabled={running}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {rows.length ? (
            <p className="text-sm">
              <span className="font-medium">{fileName}</span>: {rows.length}{" "}
              baris siap diimpor.
            </p>
          ) : null}
          {running ? (
            <progress
              className="progress progress-primary w-full"
              value={progress}
              max={rows.length}
            />
          ) : null}
          <ErrorAlert message={error} />
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={close}
              disabled={running}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run()}
              disabled={running || !rows.length || !canImport}
            >
              {running ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              Impor
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

**4. `master.ts`.** Tambahkan di bawah `saveStudent` dan `saveTeacher`. `assertStrongPassword`, `newHash`, dan `randomId` sudah terimpor karena dipakai `saveTeacher`.

```ts
const MAX_STUDENT_CHUNK = 200;
const MAX_TEACHER_CHUNK = 20; // hashing password cukup berat

const errorText = (e: unknown) => {
  if (e && typeof e === "object" && "data" in e)
    return String((e as { data: unknown }).data);
  return e instanceof Error ? e.message : "Data tidak valid.";
};

function normalizeGender(raw: string): string | null {
  const g = raw.trim().toUpperCase();
  if (!g) return "";
  if (g === "L" || g.startsWith("LAKI")) return "L";
  if (g === "P" || g.startsWith("PEREMPUAN")) return "P";
  return null;
}

function studentRowError(s: {
  nis: string;
  nisn: string;
  name: string;
  gender: string | null;
  others: string[];
}): string | null {
  if (!s.nis) return "NIS wajib diisi.";
  if (s.nis.length < LIMITS.nisMin || s.nis.length > LIMITS.nisMax)
    return `NIS harus ${LIMITS.nisMin}-${LIMITS.nisMax} karakter.`;
  if (s.nisn && !RULES.nisn.test(s.nisn)) return "NISN harus 10 digit angka.";
  if (!s.name) return "Nama lengkap wajib diisi.";
  if (
    s.name.length < LIMITS.studentNameMin ||
    s.name.length > LIMITS.personName
  )
    return `Nama lengkap harus ${LIMITS.studentNameMin}-${LIMITS.personName} karakter.`;
  if (s.gender === null) return "Jenis kelamin harus L atau P.";
  if (s.others.some((x) => x.length > 200))
    return "Isian terlalu panjang (maksimal 200 karakter).";
  return null;
}

const importStudentRow = v.object({
  line: v.number(),
  nis: v.string(),
  nisn: v.string(),
  nama_lengkap: v.string(),
  jenis_kelamin: v.string(),
  tempat_lahir: v.string(),
  tanggal_lahir: v.string(),
  alamat: v.string(),
  nama_orang_tua: v.string(),
  no_hp_orang_tua: v.string(),
});

export const importStudents = mutation({
  args: {
    token: v.string(),
    classId: v.optional(v.string()),
    rows: v.array(importStudentRow),
  },
  handler: async (ctx, { token, classId, rows }) => {
    await requireAuth(ctx, token, { admin: true });
    if (rows.length > MAX_STUDENT_CHUNK)
      fail(`Maksimal ${MAX_STUDENT_CHUNK} baris per permintaan.`);
    const cls = classId ? await classById(ctx, classId) : null;
    if (classId && !cls) fail("Kelas tidak ditemukan.");

    const failed: { line: number; reason: string }[] = [];
    let created = 0;
    for (const r of rows) {
      const nis = r.nis.trim();
      const nisn = r.nisn.trim();
      const name = r.nama_lengkap.trim();
      const gender = normalizeGender(r.jenis_kelamin);
      const others = [
        r.tempat_lahir,
        r.tanggal_lahir,
        r.alamat,
        r.nama_orang_tua,
        r.no_hp_orang_tua,
      ].map((x) => x.trim());

      const reason = studentRowError({ nis, nisn, name, gender, others });
      if (reason) {
        failed.push({ line: r.line, reason });
        continue;
      }

      const sameNis = await ctx.db
        .query("students")
        .withIndex("by_nis", (q) => q.eq("nis", nis))
        .first();
      const sameNisn = nisn
        ? await ctx.db
            .query("students")
            .withIndex("by_nisn", (q) => q.eq("nisn", nisn))
            .first()
        : null;
      if (sameNis || sameNisn) {
        failed.push({ line: r.line, reason: "NIS atau NISN sudah digunakan." });
        continue;
      }

      const now = nowIso();
      const student_id = randomId("STD");
      await ctx.db.insert("students", {
        student_id,
        nis,
        nisn,
        full_name: name,
        gender: gender ?? "",
        birth_place: others[0],
        birth_date: others[1],
        address: others[2],
        parent_name: others[3],
        parent_phone: others[4],
        is_active: true,
        created_at: now,
        updated_at: now,
      });
      if (cls)
        await ctx.db.insert("student_class_history", {
          history_id: randomId("HST"),
          student_id,
          class_id: cls.class_id,
          academic_year: cls.academic_year,
          start_date: now,
          end_date: "",
          is_active: true,
          created_at: now,
        });
      created++;
    }
    return { created, failed };
  },
});

const importTeacherRow = v.object({
  line: v.number(),
  username: v.string(),
  nama_lengkap: v.string(),
  nip: v.string(),
  no_hp: v.string(),
  email: v.string(),
  password: v.string(),
});

export const importTeachers = mutation({
  args: { token: v.string(), rows: v.array(importTeacherRow) },
  handler: async (ctx, { token, rows }) => {
    await requireAuth(ctx, token, { admin: true });
    if (rows.length > MAX_TEACHER_CHUNK)
      fail(`Maksimal ${MAX_TEACHER_CHUNK} baris per permintaan.`);

    const failed: { line: number; reason: string }[] = [];
    let created = 0;
    for (const r of rows) {
      const username = r.username.trim();
      const fullName = r.nama_lengkap.trim();
      const nip = r.nip.trim();
      const phone = r.no_hp.trim();
      const email = r.email.trim();
      const pw = r.password;

      try {
        if (!fullName) fail("Nama lengkap wajib diisi.");
        if (!RULES.username.test(username))
          fail(
            "Username 3-30 karakter: huruf, angka, titik, garis bawah, atau strip.",
          );
        if (nip && !RULES.nip.test(nip))
          fail("NIP hanya berisi angka (5-30 digit).");
        if (phone && !RULES.phone.test(phone)) fail("Nomor HP tidak valid.");
        if (email && !RULES.email.test(email))
          fail("Format email tidak valid.");
        if (!pw) fail("Password wajib diisi.");
        assertStrongPassword(pw, [username, fullName, nip, phone]);

        const sameName = await ctx.db
          .query("users")
          .withIndex("by_username_lc", (q) =>
            q.eq("username_lc", username.toLowerCase()),
          )
          .first();
        if (sameName) fail("Username sudah digunakan.");
        if (nip) {
          const sameNip = await ctx.db
            .query("users")
            .withIndex("by_nip", (q) => q.eq("nip", nip))
            .first();
          if (sameNip) fail("NIP sudah digunakan.");
        }
      } catch (e) {
        failed.push({ line: r.line, reason: errorText(e) });
        continue;
      }

      const now = nowIso();
      await ctx.db.insert("users", {
        user_id: randomId("USR"),
        username,
        username_lc: username.toLowerCase(),
        ...(await newHash(pw)),
        full_name: fullName,
        role: "guru",
        assigned_classes: [],
        is_active: true,
        nip,
        phone,
        email,
        student_id: "",
        must_change_password: true,
        created_at: now,
        updated_at: now,
      });
      created++;
    }
    return { created, failed };
  },
});
```

Kalau `student_class_history` di skema punya field wajib lain, ikuti insert di `saveStudent`.

**5. Route server dan API.** `convex.server.ts`, setelah `moveStudent`:

```ts
  importStudents: mutationRoute(
    api.master.importStudents,
    ([rows, classId]) => ({ rows, classId }),
  ),
  importTeachers: mutationRoute(api.master.importTeachers, ([rows]) => ({
    rows,
  })),
```

`api.ts`, setelah `moveStudent`:

```ts
  importStudents: (rows: Record<string, string | number>[], classId?: string) =>
    rpc<ImportResult>("importStudents", rows, classId),
  importTeachers: (rows: Record<string, string | number>[]) =>
    rpc<ImportResult>("importTeachers", rows),
```

Tambahkan `ImportResult` ke impor tipe di `api.ts`.

**6. `students/index.tsx`.** Impor:

```tsx
import { Upload } from "lucide-react";
```

```tsx
import type { ImportField } from "~/components/csv-import-modal";

import { CsvImportModal } from "~/components/csv-import-modal";
```

Di atas komponen:

```tsx
const STUDENT_IMPORT_FIELDS: ImportField[] = [
  { key: "nis", label: "NIS", required: true, example: "2026001", text: true },
  {
    key: "nisn",
    label: "NISN, 10 digit (opsional)",
    example: "0012345678",
    text: true,
  },
  {
    key: "nama_lengkap",
    label: "Nama lengkap",
    required: true,
    example: "Budi Santoso",
  },
  { key: "jenis_kelamin", label: "L atau P", example: "L" },
  { key: "tempat_lahir", label: "Tempat lahir", example: "Bandung" },
  { key: "tanggal_lahir", label: "Tanggal lahir", example: "2010-05-17" },
  { key: "alamat", label: "Alamat", example: "Jl. Merdeka No. 1" },
  { key: "nama_orang_tua", label: "Nama orang tua", example: "Slamet" },
  {
    key: "no_hp_orang_tua",
    label: "No. HP orang tua",
    example: "081234567890",
    text: true,
  },
];
```

Di `StudentsPage`:

```tsx
const [importing, setImporting] = useState(false);
const [importClass, setImportClass] = useState("");
```

Tombol di header, di samping "Tambah Siswa" (untuk admin):

```tsx
<HeaderButton
  label="Impor CSV"
  className="btn-outline"
  icon={<Upload className="size-4" />}
  onClick={() => setImporting(true)}
/>
```

Modal, sebelum `{dialog}`:

```tsx
<CsvImportModal
  open={importing}
  onClose={() => setImporting(false)}
  title="Impor Data Siswa"
  templateName="siswa"
  fields={STUDENT_IMPORT_FIELDS}
  chunkSize={100}
  send={(rows) => api.importStudents(rows, importClass || undefined)}
  onFinished={() =>
    void Promise.all([
      qc.invalidateQueries({ queryKey: qk.students }),
      qc.invalidateQueries({ queryKey: qk.studentClasses }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
    ])
  }
  extra={
    <label className="form-control w-full">
      <span className="label-text mb-1 block text-sm">
        Tempatkan di kelas (opsional)
      </span>
      <select
        className="select w-full"
        value={importClass}
        onChange={(e) => setImportClass(e.target.value)}
      >
        <option value="">Tanpa kelas</option>
        {classes
          .filter((c) => isActive(c.is_active))
          .map((c) => (
            <option
              key={c.class_id}
              value={c.class_id}
            >
              {c.class_name} ({c.academic_year || "-"})
            </option>
          ))}
      </select>
    </label>
  }
/>
```

Sesuaikan nama `classes` dan `qc` dengan variabel yang sudah ada di halaman itu.

**7. `teachers/index.tsx`.** Belum saya punya, jadi ini potongan siap tempel. Polanya sama dengan siswa: tombol `Impor CSV` untuk admin di header, `useState(false)` untuk `importing`, lalu modal ini. Ganti `qk.teachers` kalau namanya berbeda:

```tsx
const TEACHER_IMPORT_FIELDS: ImportField[] = [
  {
    key: "username",
    label: "Username (3-30 karakter)",
    required: true,
    example: "budi.guru",
  },
  {
    key: "nama_lengkap",
    label: "Nama lengkap",
    required: true,
    example: "Budi Hartono, S.Pd.",
  },
  {
    key: "nip",
    label: "NIP (opsional)",
    example: "198001012005011001",
    text: true,
  },
  {
    key: "no_hp",
    label: "No. HP (opsional)",
    example: "081234567890",
    text: true,
  },
  { key: "email", label: "Email (opsional)", example: "budi@sekolah.sch.id" },
  {
    key: "password",
    label: "Password awal, wajib kuat",
    required: true,
    example: "GantiSaya#2026",
  },
];
```

```tsx
<CsvImportModal
  open={importing}
  onClose={() => setImporting(false)}
  title="Impor Data Guru"
  templateName="guru"
  fields={TEACHER_IMPORT_FIELDS}
  chunkSize={10}
  send={(rows) => api.importTeachers(rows)}
  onFinished={() => void qc.invalidateQueries({ queryKey: qk.teachers })}
/>
```

Beberapa catatan:

- Item 11 belum dicentang sampai tombol di halaman guru terpasang. Kirim `teachers/index.tsx` kalau mau saya tempatkan tepat.
- Kelas guru (`assigned_classes`) tidak diisi lewat impor, tetapi diatur lewat menu Pengampu Mapel.
- Berkas guru berisi password teks biasa, jadi hapus setelah impor. Semua akun hasil impor wajib ganti password saat login pertama (`must_change_password`).
- Impor siswa tidak membuat akun login. Akun dibuat lewat alur yang sudah ada (Reset Akun), karena password awalnya NISN.
- Impor ulang aman. Baris yang NIS, NISN, atau username-nya sudah ada akan dilewati dan masuk laporan.

Ini tombol impor untuk `routes/_app/teachers/index.tsx` (belum diuji). Halaman ini hanya untuk admin, jadi tombolnya tidak perlu pengecekan peran.

**1. Impor:**

```tsx
import { Eye, Pencil, Plus, Upload, UserCheck, UserX } from "lucide-react";
```

```tsx
import type { ImportField } from "~/components/csv-import-modal";

import { CheckboxGroupField } from "~/components/checkbox-group-field";
import { CsvImportModal } from "~/components/csv-import-modal";
```

**2. Di atas `TeachersPage`:**

```tsx
const TEACHER_IMPORT_FIELDS: ImportField[] = [
  {
    key: "username",
    label: "Username (3-30 karakter)",
    required: true,
    example: "budi.guru",
  },
  {
    key: "nama_lengkap",
    label: "Nama lengkap",
    required: true,
    example: "Budi Hartono, S.Pd.",
  },
  {
    key: "nip",
    label: "NIP (opsional)",
    example: "198001012005011001",
    text: true,
  },
  {
    key: "no_hp",
    label: "No. HP (opsional)",
    example: "081234567890",
    text: true,
  },
  { key: "email", label: "Email (opsional)", example: "budi@sekolah.sch.id" },
  {
    key: "password",
    label: "Password awal, wajib kuat",
    required: true,
    example: "GantiSaya#2026",
  },
];
```

**3. State di `TeachersPage`, setelah `const [search, setSearch] = ...`:**

```tsx
const [importing, setImporting] = useState(false);
```

**4. Tombol di header:**

```tsx
<PageHeader title="Manajemen Guru">
  <HeaderButton
    label="Impor CSV"
    className="btn-outline"
    icon={<Upload className="size-4" />}
    onClick={() => setImporting(true)}
  />
  <HeaderButton
    label="Tambah Guru"
    icon={<Plus className="size-4" />}
    onClick={() => setModal((m) => ({ ...m, open: true }))}
  />
</PageHeader>
```

**5. Modal, sebelum `{dialog}`:**

```tsx
<CsvImportModal
  open={importing}
  onClose={() => setImporting(false)}
  title="Impor Data Guru"
  templateName="guru"
  fields={TEACHER_IMPORT_FIELDS}
  chunkSize={10}
  send={(rows) => api.importTeachers(rows)}
  onFinished={() => void qc.invalidateQueries({ queryKey: qk.teachers })}
/>;
{
  dialog;
}
```

Semua bagian item 11 sekarang sudah terpasang: siswa dan guru, `csv-import-modal.tsx`, dua mutation, route server, dan `api.ts`. Perbarui `todo.md`:

````md
```
[███████████████░░░░░] 74% Selesai
- Selesai          : 14 Task (Seluruh P0 + Seluruh P1 + P2 poin 9, 10, 11)
- Sedang Berjalan  : 0 Task
- Dalam Antrean    : 5 Task (P2, P3)
```
````

```md
- [x] **11. Impor Data Siswa & Guru Massal via Excel/CSV**
  - _Hasil_: modal reusable `src/components/csv-import-modal.tsx` (template, validasi header, progres per batch, laporan baris yang dilewati), parser `parseCsv`, mutation `importStudents` dan `importTeachers`. Format CSV saja, password awal guru lewat kolom `password`, baris bermasalah dilewati.
```

Sebelum dipakai di produksi, uji dulu dengan berkas kecil yang sengaja dibuat bermasalah (NIS ganda, password lemah, kolom wajib hilang) untuk memastikan laporan baris yang dilewati tampil benar.
