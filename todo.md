# TODO - Rencana Perbaikan & Pengembangan Fitur EduAbsen

Dokumen pelacak tugas (*task tracking*) untuk rencana perbaikan, peningkatan pengalaman pengguna (UX/UI), dan penambahan fitur aplikasi **EduAbsen**.

---

## Ringkasan Progres

```
[██████████░░░░░░░░░░] 50% Selesai
- Selesai          : 4 Task (Migrasi Convex, Sesi Aman, PRD & Docs, Dark Mode CSS)
- Sedang Berjalan  : 1 Task (Persiapan PWA & Mobile Touch)
- Dalam Antrean    : 15 Task
```

---

## 🚀 Prioritas 0 (P0) - Mobile UX & Responsivitas Layar Sentuh

Tugas pada kategori ini berfokus pada kemudahan penggunaan guru dan siswa yang mengakses aplikasi dari ponsel pintar (smartphone Android/iOS).

- [ ] **1. Mode Input Absensi Ramah Sentuh (Touch-Friendly Segmented Chips)**
  - *Lokasi*: `src/components/attendance-grid.tsx`
  - *Deskripsi*: Ganti baris checkbox kecil tabel dengan tombol segmented pill (`[H] [S] [I] [A]`) yang memiliki touch target minimal 44×44px.
  - *Fitur*:
    - Warna status aktif kontras (Hijau Hadir, Kuning Sakit, Biru Izin, Merah Alpa).
    - Haptic feedback getar halus perangkat (`navigator.vibrate?.(15)`) saat tombol status ditekan.
- [ ] **2. Sticky Column & Header pada Tabel Lebar**
  - *Lokasi*: `src/components/ui/data-table.tsx`, `src/styles.css`
  - *Deskripsi*: Buat kolom **No** dan **Nama Siswa** tetap membeku (*sticky left*) saat tabel di-scroll mendatar (*horizontal scroll*) di layar sempit.
  - *Manfaat*: Guru tidak kehilangan nama siswa saat mencentang absensi atau mengisi nilai di kolom sebelah kanan.
- [ ] **3. Filter Cepat "Belum Diabsen"**
  - *Lokasi*: `src/routes/_app/attendance.tsx`, `src/components/attendance-grid.tsx`
  - *Deskripsi*: Tambahkan filter tab/chip di atas tabel: `Semua Siswa`, `Belum Diabsen (X)`, `Perlu Keterangan (Y)`.
  - *Manfaat*: Mempercepat pengisian absensi kelas dari puluhan siswa menjadi hitungan detik.
- [ ] **4. PWA (Progressive Web App) Standalone Support**
  - *Lokasi*: `public/manifest.webmanifest`, `src/routes/__root.tsx`
  - *Deskripsi*:
    - Buat berkas `manifest.webmanifest` lengkap dengan nama aplikasi, warna tema, dan ikon homescreen.
    - Tambahkan meta tags `apple-mobile-web-app-capable`, `theme-color`, dan `mobile-web-app-capable`.
    - Pengguna Android/iOS dapat menekan tombol *"Instal ke Layar Utama"* dan membuka aplikasi secara full-screen tanpa address bar browser.

---

## 🎨 Prioritas 1 (P1) - Kecepatan Visual (*Perceived Speed*) & Polish

Tugas untuk menghilangkan jeda visual dan membuat aplikasi terasa instan dan modern.

- [ ] **5. Komponen Skeleton Shimmer (Pengganti PageSpinner)**
  - *Lokasi*: `src/components/ui/skeleton.tsx`, `src/components/ui/page-spinner.tsx`
  - *Deskripsi*: Gantikan animasi spinner layar penuh yang kosong dengan placeholder shimmer beranimasi abu-abu halus sesuai bentuk kartu dashboard dan baris tabel.
  - *Target*: Pemuatan awal rute Dashboard, Input Absensi, Nilai, dan Data Siswa.
- [ ] **6. Theme Switcher (Toggle Mode Gelap/Terang/Sistem)**
  - *Lokasi*: `src/routes/_app.tsx` (Navbar Header / Drawer Bawah)
  - *Deskripsi*: Tambahkan tombol toggle cepat (ikon Matahari ☀️ / Bulan 🌙 / Komputer 💻) untuk berpindah antara tema Terang, Gelap, atau Otomatis mengikuti OS, dengan penyimpanan preferensi di `localStorage`.
- [ ] **7. Indikator Visual Autosave Tugas Siswa**
  - *Lokasi*: `src/routes/_app/tasks/$assignmentId.tsx`
  - *Deskripsi*: Tambahkan badge status mikro di sudut atas layar saat siswa mengerjakan tugas:
    - *"Menyimpan draf..."* (ikon awan berputar).
    - *"Tersimpan otomatis pk 08:35 ✓"* (warna hijau lembut).
  - *Manfaat*: Memberikan kepastian psikologis bagi siswa bahwa jawaban ujian mereka tidak hilang.
- [ ] **8. Desain Empty State Informatif**
  - *Lokasi*: Seluruh rute tabel (`assignments`, `tasks`, `classes`, `subjects`, `reports`)
  - *Deskripsi*: Ganti teks datar *"Tidak ada data"* dengan komponen ilustrasi ramah dan tombol aksi langsung (misal: *"Belum ada tugas untuk kelas ini. [Buat Tugas Baru +]"*).

---

## ⚡ Prioritas 2 (P2) - Produktivitas & Input Cepat Desktop

Optimasi untuk admin dan guru yang bekerja menggunakan laptop atau komputer sekolah.

- [ ] **9. Pintasan Keyboard (*Keyboard Shortcuts*) pada Input Absensi & Nilai**
  - *Lokasi*: `src/components/attendance-grid.tsx`, `src/routes/_app/grades.tsx`
  - *Fitur*:
    - Tombol panah atas/bawah (`ArrowUp` / `ArrowDown`) untuk berpindah antar-baris siswa.
    - Tombol cepat huruf: `H` (Hadir), `S` (Sakit), `I` (Izin), `A` (Alpa).
    - Tombol `Enter` untuk membuka modal isian keterangan.
- [ ] **10. Ekspor Laporan Presensi ke Excel / CSV**
  - *Lokasi*: `src/routes/_app/reports.tsx`, `src/components/subject-report-view.tsx`
  - *Deskripsi*: Tambahkan tombol *"Ekspor CSV"* di samping tombol *"Cetak"* agar rekap presensi bulanan dapat diolah lebih lanjut untuk keperluan laporan dinas/yayasan.
- [ ] **11. Impor Data Siswa & Guru Massal via Excel/CSV**
  - *Lokasi*: `src/routes/_app/students/index.tsx`, `src/routes/_app/teachers/index.tsx`
  - *Deskripsi*: Form unggah berkas CSV/Excel berbasis template standar untuk mengimpor puluhan hingga ratusan siswa baru sekaligus saat tahun ajaran baru.
- [ ] **12. Konfirmasi Ganda untuk Tindakan Kritis**
  - *Lokasi*: `src/hooks/use-confirm.tsx`, `src/routes/_app/students/index.tsx`
  - *Deskripsi*: Tambahkan dialog konfirmasi dengan pengetikan nama atau teks konfirmasi untuk tindakan permanen:
    - Meluluskan siswa (menonaktifkan akun).
    - Menghapus tugas yang sudah memiliki jawaban siswa.
    - Reset akun siswa massal.

---

## 🌐 Prioritas 3 (P3) - Resiliensi Jaringan & Fitur Lanjutan

Fitur untuk institusi sekolah dengan tantangan infrastruktur internet yang tidak menentu.

- [ ] **13. Offline Connectivity Banner**
  - *Lokasi*: `src/routes/__root.tsx`, `src/components/ui/offline-banner.tsx`
  - *Deskripsi*: Deteksi perubahan status jaringan (`window.addEventListener('online'/'offline')`).
  - *Tampilan*: Bar notifikasi oranye di bagian atas: *"Koneksi terputus. Anda sedang offline. Mohon tidak menutup halaman hingga jaringan kembali normal."*
- [ ] **14. Validasi Batas Nilai KKM Interaktif**
  - *Lokasi*: `src/routes/_app/grades.tsx`
  - *Deskripsi*: Peringatan visual langsung pada input nilai jika angka yang dimasukkan di luar rentang $0 - 100$ atau jika bobot total komponen nilai belum berjumlah $100\%$.
- [ ] **15. Pemantauan Kehadiran Wali Kelas (Homeroom Overview)**
  - *Lokasi*: `src/routes/_app/dashboard.tsx`
  - *Deskripsi*: Tambahkan tab atau widget khusus bagi guru yang berstatus wali kelas untuk melihat rangkuman absensi harian dan mata pelajaran khusus kelas bimbingannya dalam satu layar.
- [ ] **16. Integrasi Cetak Rapor Siswa Resmi (Format PDF)**
  - *Lokasi*: `src/routes/_app/grades.tsx`, `src/routes/_app/my-grades.tsx`
  - *Deskripsi*: Template halaman cetak rapor nilai per semester lengkap dengan tanda tangan Kepala Sekolah dan Wali Kelas.

---

## 📋 Riwayat Tugas Selesai

- [x] **Migrasi Penuh Arsitektur ke Convex**: Schema terdefinisi, mutasi transaksional ACID, realtime subscriptions.
- [x] **Pola Keamanan Sesi Hybrid**: Token sesi httpOnly pada server Start, JWT jangka pendek untuk browser, proteksi brute-force login lockout.
- [x] **Pembaruan Dokumentasi Inti**:
  - `README.md` diperbarui dengan arsitektur Convex, stack TanStack Start, dan panduan instalasi.
  - `PRD.md` (Product Requirements Document) dibuat komprehensif mencakup 9 modul fungsional dan diagram alir.
- [x] **Dukungan Dark Mode di [styles.css](file:///data/user/0/com.termux/files/home/absensi-tanstack/src/styles.css)**:
  - Registrasi tema `eduabsen-dark` dengan `--prefersdark` di DaisyUI 5 dan Tailwind v4.
  - Dukungan otomatis `prefers-color-scheme: dark` pada date-picker dan reset background putih pada mode cetak dokumen.
