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
        onFinished={() =>
          void qc.invalidateQueries({ queryKey: qk.teachers })
        }
      />
      {dialog}
```

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
        onFinished={() =>
          void qc.invalidateQueries({ queryKey: qk.teachers })
        }
      />
      {dialog}
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