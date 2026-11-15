# EduAbsen - Sistem Manajemen Kehadiran & Akademik Sekolah

Aplikasi manajemen kehadiran (absensi), tugas siswa (CBT), dan buku nilai terintegrasi berbasis **TanStack Start** dan backend realtime **Convex**.

```
┌─────────────────────────────────────────────────────────────┐
│                    ARSITEKTUR EDUMANAGE                     │
├─────────────────┬───────────────────────────┬───────────────┤
│  Browser Client │  TanStack Start Server    │ Convex Cloud  │
│  (React 19 SPA) │  (Nitro / Server Fn)      │ (Realtime DB) │
└────────┬────────┴─────────────┬─────────────┴───────┬───────┘
         │                      │                     │
         ├──── Cookie Sesi ─────┤                     │
         │   (httpOnly)         │                     │
         │                      ├──── RPC / Mutasi ───┤
         │                      │    (Server-to-Server│
         │                      │                     │
         ├──────── Langganan Realtime (JWT) ──────────┤
         │        (WebSocket TanStack Query)          │
```

---

## Fitur Utama

- **Multi-Role & Akses Berbasis Peran (RBAC)**:
  - **Admin**: Master data (siswa, kelas, guru, mapel, pengampu), kenaikan kelas & kelulusan, reset akun, pengaturan sekolah.
  - **Guru**: Input absensi harian & per mata pelajaran, pembuatan tugas & koreksi esai, penginputan dan konfigurasi buku nilai (KKM & bobot).
  - **Siswa**: Dashboard kehadiran mandiri, pengerjaan tugas online dengan autosave berkala, melihat rekap nilai dan predikat per semester.
- **Absensi Harian & Mata Pelajaran**:
  - Validasi batas tanggal masa depan dan jendela edit (*edit window*) yang dapat dikonfigurasi.
  - Ringkasan harian instan (*daily aggregation*) untuk performa tinggi pada dashboard.
  - Catatan wajib otomatis untuk siswa dengan status Sakit, Izin, atau Alpa.
- **Tugas & Ujian Siswa (CBT)**:
  - Soal pilihan ganda dinilai otomatis secara instan.
  - Soal esai dengan antarmuka review dan penilaian guru.
  - Fitur batas durasi pengerjaan (*timer countdown*) dan autosave draf otomatis jika koneksi terputus atau tab diminimalkan.
- **Buku Nilai (GradeBook) & KKM**:
  - Konfigurasi bobot komponen nilai dinamis per kelas dan mapel (sumber tugas otomatis maupun manual).
  - Perhitungan otomatis nilai akhir, status ketuntasan (KKM), dan predikat.
- **Kenaikan Kelas & Kelulusan**:
  - Promosi massal siswa antar-kelas dan tingkat dengan validasi tahun ajaran.
  - Modul kelulusan siswa tingkat akhir dengan penutupan riwayat kelas otomatis.
- **Keamanan & Proteksi Akun**:
  - Token sesi disimpan di cookie `httpOnly` pada server Start; token tidak tersimpan di `localStorage` peramban.
  - Kebijakan pergantian password bawaan saat pertama kali masuk.
  - Proteksi *brute-force* login dengan penguncian akun bertahap (*exponential lockout*).

---

## Teknologi yang Digunakan

| Kategori | Paket / Teknologi |
| :--- | :--- |
| **Framework Fullstack** | [`@tanstack/react-start`](https://tanstack.com/start), [`nitro`](https://nitro.unjs.io) |
| **Routing** | [`@tanstack/react-router`](https://tanstack.com/router) (File-based Routing, Code-Splitting) |
| **Data Fetching & Cache** | [`@tanstack/react-query`](https://tanstack.com/query), [`@convex-dev/react-query`](https://github.com/get-convex/convex-react-query) |
| **Backend & Database** | [Convex](https://convex.dev) (`convex` ^1.49.0 - Reaktif & Transaksional) |
| **Manajemen Form** | [`@tanstack/react-form`](https://tanstack.com/form) |
| **Tabel Data** | [`@tanstack/react-table`](https://tanstack.com/table) (v9) |
| **Visualisasi / Grafik** | [`@tanstack/charts`](https://tanstack.com/charts) |
| **Styling & UI** | Tailwind CSS v4, DaisyUI v5, [`lucide-react`](https://lucide.dev) |
| **Validasi Skema** | [`zod`](https://zod.dev) v4 |

---

## Panduan Instalasi & Menjalankan

### 1. Prasyarat
- **Node.js**: Versi 20.x atau lebih baru (disarankan LTS).
- **Package Manager**: `pnpm` (disarankan) atau `npm`.
- **Akun Convex**: [Daftar akun gratis di Convex](https://convex.dev).

### 2. Kloning & Pemasangan Dependensi
```bash
git clone <url-repo>
cd absensi-tanstack

# Pasang dependensi project
pnpm install
# Atau: npm install
```

### 3. Konfigurasi Lingkungan (.env)
Salin berkas contoh `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Sesuaikan variabel lingkungan di `.env`:
```env
# Deployment Convex
CONVEX_DEPLOYMENT=dev:eduabsen-xxx

# URL Convex Deployment
CONVEX_URL=https://eduabsen-xxx.convex.cloud
VITE_CONVEX_URL=https://eduabsen-xxx.convex.cloud

# Opsional: Secret bersama untuk validasi IP klien saat login
# LOGIN_SHARED_SECRET=kunci-rahasia-anda
```

### 4. Menjalankan Server Pengembangan

Jalankan Convex backend (di terminal pertama):
```bash
npx convex dev
```

Jalankan frontend TanStack Start (di terminal kedua):
```bash
pnpm dev
# Atau: npm run dev
```
Buka browser pada alamat [http://localhost:3000](http://localhost:3000).

---

## Skrip yang Tersedia

- `pnpm dev` : Menjalankan Vite dev server untuk frontend.
- `pnpm build` : Menjalankan kompilasi TypeScript dan pembuatan artefak build produksi.
- `pnpm preview` : Menjalankan preview aplikasi hasil build lokal.
- `pnpm typecheck` : Melakukan pengecekan tipe statis dengan `tsc --noEmit`.
- `pnpm lint` : Memeriksa kode menggunakan `oxlint`.
- `pnpm format` : Memformat kode secara konsisten menggunakan `oxfmt`.

---

## Struktur Direktori

```
absensi-tanstack/
├── convex/                   # Backend Convex (schema, fungsi query/mutasi/cron)
│   ├── _generated/           # Tipe dan API yang dibuat otomatis oleh Convex
│   ├── assignment.ts         # Logika tugas & ujian siswa
│   ├── attendance.ts         # Logika absensi harian
│   ├── auth.ts               # Autentikasi, pembuatan JWT, manajemen sesi
│   ├── grades.ts             # Logika buku nilai & penilaian
│   ├── master.ts             # Master data (siswa, kelas, guru, kenaikan kelas)
│   ├── rules.ts              # Aturan bisnis, jenjang tingkat, format tanggal
│   ├── schema.ts             # Definisi skema tabel & indeks database
│   ├── settings.ts           # Konfigurasi sekolah & tahun ajaran aktif
│   └── subjects.ts           # Mata pelajaran, pengampu, absensi mapel
├── src/
│   ├── components/           # Komponen UI (DataTable, Modal, Form Fields, Charts, dll.)
│   ├── hooks/                # Custom React hooks (draft autosave, countdown, confirm dialog)
│   ├── lib/                  # Skema validasi Zod, API client, query options
│   ├── routes/               # Rute aplikasi TanStack Router
│   │   ├── __root.tsx        # Root layout, penyedia tema & QueryClient
│   │   ├── login.tsx         # Halaman login publik dengan countdown lockout
│   │   ├── _app.tsx          # Layout utama berautentikasi (Sidebar, Drawer, Navigasi)
│   │   └── _app/             # Rute dashboard, absensi, tugas, nilai, laporan, data master
│   ├── server/               # Server functions TanStack Start (Nitro)
│   │   ├── convex.server.ts  # Jembatan server-to-server ke Convex HTTP Client
│   │   └── functions.ts      # Server functions (loginFn, rpcFn, getMeFn, getConvexJwtFn)
│   ├── router.tsx            # Inisialisasi QueryClient, ConvexClient, & TanStack Router
│   └── styles.css            # Pengaturan Tailwind CSS v4 & tema DaisyUI
├── public/                   # Aset publik statis (favicon, ikon)
├── package.json              # Dependensi dan skrip proyek
└── PRD.md                    # Product Requirements Document (Spesifikasi Lengkap)
```

---

## Lisensi & Kontribusi

Aplikasi ini dikembangkan untuk penggunaan instansi pendidikan. Segala saran dan kontribusi pengembangan dapat disampaikan melalui pembuatan *Pull Request* atau *Issue* pada repositori ini.
