# Modularisasi Backend Per Domain

Dokumen ini menetapkan arah modularisasi backend agar aplikasi EduAbsen tetap mudah dipelihara, aman, dan siap berkembang saat domain bisnis makin bertambah.

## Tujuan

1. Memisahkan logic berdasarkan domain bisnis utama.
2. Mengurangi coupling antar modul.
3. Menetapkan boundary ownership yang jelas.
4. Membuat review, testing, dan refactor lebih mudah dilakukan.

## Masalah yang ingin dihindari

Jika semua logic backend dibiarkan dalam satu struktur besar, maka:

- perubahan kecil memengaruhi area yang tidak relevan,
- domain dan constraint bisnis bercampur,
- onboarding developer menjadi lebih sulit,
- validasi dan authorization sulit dikontrol secara konsisten,
- debugging dan testing menjadi lebih kompleks.

## Domain utama yang disarankan

### 1. Auth

Domain ini mencakup:

- login
- logout
- session
- token
- user context
- role access

Komponen terkait:

- `src/server/functions.ts`
- `src/lib/auth.ts`
- route guard
- session validation

### 2. Master data

Domain ini mencakup:

- siswa
- guru
- kelas
- mapel
- pengampu
- riwayat kelas

Tujuan:

- memastikan data master jelas, konsisten, dan tidak tercampur dengan operational logic.

### 3. Attendance

Domain ini mencakup:

- absensi harian
- absensi per mata pelajaran
- ringkasan harian
- status kehadiran

Tujuan:

- memastikan absensi memiliki validasi tanggal, status, dan integritas data yang tepat.

### 4. Assignments

Domain ini mencakup:

- tugas
- jadwal pengumpulan
- status publikasi
- otomatisasi tugas siswa
- review jawaban

### 5. Grades

Domain ini mencakup:

- nilai siswa
- KKM
- komponen nilai
- kenaikan kelas dan kelulusan

Tujuan:

- menghindari logika penilaian tersebar di banyak file yang tidak jelas kepemilikannya.

### 6. Reports

Domain ini mencakup:

- laporan absensi
- laporan nilai
- rekap kelas
- dashboard agregat

Tujuan:

- menjaga query besar dan agregasi data tidak bercampur dengan operasi CRUD domain lain.

### 7. Settings

Domain ini mencakup:

- setting sekolah
- tahun ajaran
- konfigurasi operasional
- kebijakan aplikasi

Tujuan:

- menjamin satu sumber kebenaran untuk parameter global aplikatif.

## Struktur modular yang disarankan

Arah idealnya adalah:

- satu folder per domain atau satu module per concern
- fungsi terkait domain dipindahkan ke tempat yang relevan
- API contract jelas untuk masing-masing domain
- modul tidak boleh menggantung ke domain lain tanpa boundary yang didefinisikan

Contoh conceptual structure:

- `convex/auth/`
- `convex/master-data/`
- `convex/attendance/`
- `convex/assignments/`
- `convex/grades/`
- `convex/reports/`
- `convex/settings/`

Setiap modul harus memiliki:

- fungsi query utama
- fungsi mutation utama
- validasi domain
- aturan role access
- dokumentasi singkat domain ownership

## Lapisan dasar (`convex/`)

- `errors.ts`: `fail`. Tidak mengimpor apa pun dari proyek.
- `security.ts`: kripto, hash password, kebijakan password.
- `access.ts`: autentikasi sesi (`requireAuth`, `revokeSessions`) dan otorisasi (`canAccessClass`, `canTeach`).
- `lib.ts`: util umum, waktu, pencarian entitas, bentuk keluaran.
- Aturan: `errors`, `security`, dan `access` tidak boleh mengimpor `lib` (mencegah siklus).

## Boundary yang harus dijaga

- Auth tidak boleh dipanggil tanpa validasi session
- Master data tidak boleh menjadi tempat logic attendance atau grading yang tidak relevan
- Assignment harus fokus pada tugas dan jawaban, bukan konfigurasi sekolah
- Reports harus bekerja dari data yang sudah valid, bukan menjadi tempat validasi utama
- Settings harus menjadi konfigurasi, bukan tempat business logic yang terfragmentasi

## Prinsip ownership

Setiap domain harus punya owner yang jelas, minimal dalam bentuk:

- file utama domain
- daftar fungsi domain
- daftar rule/business logic
- kontrak input/output yang sudah terdokumentasi

## Checklist penerapan

- [ ] Setiap domain utama punya modul/area khusus
- [ ] Logic domain tidak tersebar di file yang tidak relevan
- [ ] Authorization dan akses role diatur di domain yang tepat
- [ ] Validasi dan business rule di domain tersebut disentralisasi
- [ ] Query dan mutation relevan ditempatkan di modul domain masing-masing
- [ ] Boundary antar domain terdokumentasi dan konsisten

## Kesimpulan

Modularisasi backend per domain adalah langkah penting agar aplikasi EduAbsen tetap teratur, aman, dan mudah dikembangkan. Dengan boundary domain yang jelas, perubahan di satu area tidak akan memicu regresi besar di area lain.
