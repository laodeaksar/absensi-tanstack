# Review Performa Dashboard dan Laporan

Dokumen ini merangkum strategi review performa pada dashboard, laporan, dan fitur list data besar agar aplikasi EduAbsen tetap cepat dan stabil saat volume data meningkat.

## Tujuan

1. Menjaga responsivitas UI pada dashboard dan laporan utama.
2. Mengurangi beban query yang tidak perlu.
3. Mengidentifikasi area data besar yang membutuhkan agregasi atau pembatasan scope.
4. Menetapkan prioritas optimasi berdasarkan dampak bisnis.

## Area yang perlu diperiksa

### 1. Dashboard

Area yang sering menampilkan ringkasan data:
- jumlah siswa per kelas
- absensi harian
- persentase kehadiran
- status siswa aktif

Risiko:
- memuat terlalu banyak detail untuk satu widget
- menghitung ulang data besar di client secara berlebihan
- query multi-join yang terlalu berat

### 2. Laporan

Area yang biasanya menghasilkan output agregat seperti:
- laporan absensi bulanan
- rekap nilai kelas
- laporan siswa per semester

Risiko:
- memanggil data mentah dalam jumlah besar untuk satu view
- me-render banyak baris tanpa pagination atau filter yang memadai
- pengulangan query yang tidak perlu saat user berinteraksi cepat

### 3. List data besar

Area yang berpotensi besar:
- data siswa
- data guru
- data absensi harian
- tugas dan jawaban
- nilai per kelas dan siswa

Risiko:
- memproses terlalu banyak item di satu render
- loading yang berkepanjangan
- cache query yang tidak diatur dengan baik

## Strategi review performa

### 1. Audit payload dan scope query

Periksa apakah query mengembalikan data yang benar-benar dibutuhkan atau justru data yang terlalu besar.

Prioritas:
- batasi field yang diambil
- fokus pada data yang ditampilkan
- hindari fetch seluruh dataset saat view hanya butuh subset

### 2. Review pola filter dan pagination

Untuk list yang besar, pastikan:
- filter diterapkan sejak awal
- pagination atau virtualized list dipertimbangkan bila memerlukan banyak baris
- query bisa dibatasi berdasarkan range tanggal/kelas/role yang relevan

### 3. Pertimbangkan agregasi backend

Pada dashboard dan laporan, lebih baik membangun data ringkas di backend daripada menghitung banyak data di client.

Contoh:
- ringkasan harian per kelas
- total status per tanggal
- rekap nilai per siswa dalam satu query ringkas

### 4. Review query library strategy

Periksa apakah query tersebut:
- benar-benar perlu realtime
- perlu refetch ulang saat focus window
- bisa dijaga dengan `staleTime` yang lebih sehat
- perlu invalidation setelah mutasi tertentu

## Indikator bahwa performa perlu ditingkatkan

- dashboard lambat saat dibuka pertama kali
- report lama saat mengubah filter
- list data besar terasa berat di mobile atau laptop lama
- banyak render ulang yang tidak perlu
- query berulang untuk data yang sama dalam satu halaman

## Checklist penerapan

- [ ] Query dashboard sudah dibatasi scope-nya dan tidak terlalu luas
- [ ] Report besar sudah memakai filter yang efektif
- [ ] Data ringkas dibuat di backend bila dibutuhkan berulang
- [ ] Query key dan cache strategy sudah konsisten
- [ ] Payload yang dikirim tidak mengandung data tidak perlu
- [ ] Rendering list besar dinilai untuk pagination atau optimasi tampilan

## Kesimpulan

Review performa dashboard dan laporan harus dilakukan secara berulang seiring pertumbuhan data. Fokus utama adalah mengurangi payload, membatasi scope query, dan memakai agregasi atau cache yang tepat agar user tetap merasakan respons yang cepat tanpa mengorbankan keakuratan data.
