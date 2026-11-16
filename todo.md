# TODO - Rencana Perbaikan & Pengembangan Fitur EduAbsen

Dokumen pelacak tugas (_task tracking_) untuk rencana perbaikan, peningkatan pengalaman pengguna (UX/UI), dan penambahan fitur aplikasi **EduAbsen**.

---

## Ringkasan Progres

```
[███████████████░░░░░] 75% Selesai
- Selesai          : 10 Task (Seluruh P0 + P1 poin 5, 6, 7)
- Sedang Berjalan  : 0 Task
- Dalam Antrean    : 9 Task (P1, P2, P3)
```

---

## 🚀 Prioritas 0 (P0) - Mobile UX & Responsivitas Layar Sentuh

Tugas pada kategori ini berfokus pada kemudahan penggunaan guru dan siswa yang mengakses aplikasi dari ponsel pintar (smartphone Android/iOS).

- [x] **1. Mode Input Absensi Ramah Sentuh (Touch-Friendly Segmented Chips)**
  - _Lokasi_: `src/components/attendance-grid.tsx`
  - _Deskripsi_: Ganti baris checkbox kecil tabel dengan tombol segmented pill (`[H] [S] [I] [A]`) yang memiliki touch target minimal 44×44px.
  - _Fitur_:
    - Warna status aktif kontras (Hijau Hadir, Kuning Sakit, Biru Izin, Merah Alpa).
    - Haptic feedback getar halus perangkat (`navigator.vibrate?.(15)`) saat tombol status ditekan.
- [x] **2. Sticky Column & Header pada Tabel Lebar**
  - _Lokasi_: `src/components/ui/data-table.tsx`, `src/styles.css`
  - _Deskripsi_: Buat kolom **No** dan **Nama Siswa** tetap membeku (_sticky left_) saat tabel di-scroll mendatar (_horizontal scroll_) di layar sempit.
  - _Manfaat_: Guru tidak kehilangan nama siswa saat mencentang absensi atau mengisi nilai di kolom sebelah kanan.
- [x] **3. Filter Cepat "Belum Diabsen"**
  - _Lokasi_: `src/routes/_app/attendance.tsx`, `src/components/attendance-grid.tsx`
  - _Deskripsi_: Tambahkan filter tab/chip di atas tabel: `Semua Siswa`, `Belum Diabsen (X)`, `Perlu Keterangan (Y)`.
  - _Manfaat_: Mempercepat pengisian absensi kelas dari puluhan siswa menjadi hitungan detik.
- [x] **4. PWA (Progressive Web App) Standalone Support**
  - _Lokasi_: `public/manifest.webmanifest`, `src/routes/__root.tsx`
  - _Deskripsi_:
    - Buat berkas `manifest.webmanifest` lengkap dengan nama aplikasi, warna tema, dan ikon homescreen.
    - Tambahkan meta tags `apple-mobile-web-app-capable`, `theme-color`, dan `mobile-web-app-capable`.
    - Pengguna Android/iOS dapat menekan tombol _"Instal ke Layar Utama"_ dan membuka aplikasi secara full-screen tanpa address bar browser.

---

## 🎨 Prioritas 1 (P1) - Kecepatan Visual (_Perceived Speed_) & Polish

Tugas untuk menghilangkan jeda visual dan membuat aplikasi terasa instan dan modern.

- [x] **5. Komponen Skeleton Shimmer (Pengganti PageSpinner)**
  - _Lokasi_: `src/components/ui/skeleton.tsx`, `src/components/ui/page-spinner.tsx`
  - _Deskripsi_: Gantikan animasi spinner layar penuh yang kosong dengan placeholder shimmer beranimasi abu-abu halus sesuai bentuk kartu dashboard dan baris tabel.
  - _Target_: Pemuatan awal rute Dashboard, Input Absensi, Nilai, dan Data Siswa.
- [x] **6. Theme Switcher (Toggle Mode Gelap/Terang/Sistem)**
  - _Lokasi_: `src/routes/_app.tsx` (Navbar Header / Drawer Bawah)
  - _Deskripsi_: Tambahkan tombol toggle cepat (ikon Matahari ☀️ / Bulan 🌙 / Komputer 💻) untuk berpindah antara tema Terang, Gelap, atau Otomatis mengikuti OS, dengan penyimpanan preferensi di `localStorage`.
- [x] **7. Indikator Visual Autosave Tugas Siswa**
  - _Lokasi_: `src/routes/_app/tasks/$assignmentId.tsx`
  - _Deskripsi_: Tambahkan badge status mikro di sudut atas layar saat siswa mengerjakan tugas:
    - _"Menyimpan draf..."_ (ikon awan berputar).
    - _"Tersimpan otomatis pk 08:35 ✓"_ (warna hijau lembut).
  - _Manfaat_: Memberikan kepastian psikologis bagi siswa bahwa jawaban ujian mereka tidak hilang.
- [ ] **8. Desain Empty State Informatif**
  - _Lokasi_: Seluruh rute tabel (`assignments`, `tasks`, `classes`, `subjects`, `reports`)
  - _Deskripsi_: Ganti teks datar _"Tidak ada data"_ dengan komponen ilustrasi ramah dan tombol aksi langsung (misal: _"Belum ada tugas untuk kelas ini. [Buat Tugas Baru +]"_).

---

## ⚡ Prioritas 2 (P2) - Produktivitas & Input Cepat Desktop

Optimasi untuk admin dan guru yang bekerja menggunakan laptop atau komputer sekolah.

- [ ] **9. Pintasan Keyboard (_Keyboard Shortcuts_) pada Input Absensi & Nilai**
  - _Lokasi_: `src/components/attendance-grid.tsx`, `src/routes/_app/grades.tsx`
  - _Fitur_:
    - Tombol panah atas/bawah (`ArrowUp` / `ArrowDown`) untuk berpindah antar-baris siswa.
    - Tombol cepat huruf: `H` (Hadir), `S` (Sakit), `I` (Izin), `A` (Alpa).
    - Tombol `Enter` untuk membuka modal isian keterangan.
- [ ] **10. Ekspor Laporan Presensi ke Excel / CSV**
  - _Lokasi_: `src/routes/_app/reports.tsx`, `src/components/subject-report-view.tsx`
  - _Deskripsi_: Tambahkan tombol _"Ekspor CSV"_ di samping tombol _"Cetak"_ agar rekap presensi bulanan dapat diolah lebih lanjut untuk keperluan laporan dinas/yayasan.
- [ ] **11. Impor Data Siswa & Guru Massal via Excel/CSV**
  - _Lokasi_: `src/routes/_app/students/index.tsx`, `src/routes/_app/teachers/index.tsx`
  - _Deskripsi_: Form unggah berkas CSV/Excel berbasis template standar untuk mengimpor puluhan hingga ratusan siswa baru sekaligus saat tahun ajaran baru.
- [ ] **12. Konfirmasi Ganda untuk Tindakan Kritis**
  - _Lokasi_: `src/hooks/use-confirm.tsx`, `src/routes/_app/students/index.tsx`
  - _Deskripsi_: Tambahkan dialog konfirmasi dengan pengetikan nama atau teks konfirmasi untuk tindakan permanen:
    - Meluluskan siswa (menonaktifkan akun).
    - Menghapus tugas yang sudah memiliki jawaban siswa.
    - Reset akun siswa massal.

---

## 🌐 Prioritas 3 (P3) - Resiliensi Jaringan & Fitur Lanjutan

Fitur untuk institusi sekolah dengan tantangan infrastruktur internet yang tidak menentu.

- [ ] **13. Offline Connectivity Banner**
  - _Lokasi_: `src/routes/__root.tsx`, `src/components/ui/offline-banner.tsx`
  - _Deskripsi_: Deteksi perubahan status jaringan (`window.addEventListener('online'/'offline')`).
  - _Tampilan_: Bar notifikasi oranye di bagian atas: _"Koneksi terputus. Anda sedang offline. Mohon tidak menutup halaman hingga jaringan kembali normal."_
- [ ] **14. Validasi Batas Nilai KKM Interaktif**
  - _Lokasi_: `src/routes/_app/grades.tsx`
  - _Deskripsi_: Peringatan visual langsung pada input nilai jika angka yang dimasukkan di luar rentang $0 - 100$ atau jika bobot total komponen nilai belum berjumlah $100\%$.
- [ ] **15. Pemantauan Kehadiran Wali Kelas (Homeroom Overview)**
  - _Lokasi_: `src/routes/_app/dashboard.tsx`
  - _Deskripsi_: Tambahkan tab atau widget khusus bagi guru yang berstatus wali kelas untuk melihat rangkuman absensi harian dan mata pelajaran khusus kelas bimbingannya dalam satu layar.
- [ ] **16. Integrasi Cetak Rapor Siswa Resmi (Format PDF)**
  - _Lokasi_: `src/routes/_app/grades.tsx`, `src/routes/_app/my-grades.tsx`
  - _Deskripsi_: Template halaman cetak rapor nilai per semester lengkap dengan tanda tangan Kepala Sekolah dan Wali Kelas.

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
