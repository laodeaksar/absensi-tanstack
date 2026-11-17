# Strategi Cache Query dan Performansi

Dokumen ini menetapkan kebijakan penggunaan cache query dan optimasi performa aplikasi EduAbsen untuk menjaga responsivitas tanpa mengorbankan konsistensi data.

## Tujuan

1. Menjaga UI tetap cepat saat data berubah.
2. Mengurangi over-fetching dan beban query yang tidak perlu.
3. Menentukan rancangan cache yang jelas untuk tiap jenis data.
4. Menjaga konsistensi data di dashboard, report, dan list utama.

## Prinsip dasar

1. Query data statis sebaiknya memiliki `staleTime` yang relatif panjang.
2. Query data yang sering berubah harus lebih cepat diperbarui dan punya invalidation yang tepat.
3. Query yang besar dan kompleks harus dibatasi agar tidak merusak performa.
4. Query key harus terstruktur dan konsisten agar cache tidak ambigu.

## Kategori query

### 1. Data statis atau jarang berubah

Contoh:

- master data sekolah
- referensi mata pelajaran
- konfigurasi umum

Rekomendasi:

- `staleTime` lebih panjang
- gunakan cache yang stabil
- hindari refetch yang terlalu agresif saat window focus kembali

### 2. Data user/session

Contoh:

- `me`
- profil pengguna aktif
- status autentikasi

Rekomendasi:

- cache lebih aman dengan lifetime yang wajar
- invalidasi saat terjadi perubahan auth atau logout
- refresh saat session berubah, bukan hanya saat user fokus kembali

### 3. Data yang sering berubah (realtime)

Contoh:

- absensi
- tugas siswa
- nilai
- laporan dashboard

Rekomendasi:

- gunakan query realtime atau invalidation yang terukur
- patuhi stale strategy yang memungkinkan data segar tetapi tidak terlalu sering tertabrak refetch berlebihan
- hindari query besar di setiap perubahan kecil jika tidak perlu

### 4. Data laporan dan dashboard agregat

Contoh:

- dashboard summary
- laporan presensi bulanan
- rekap nilai kelas

Rekomendasi:

- batasi scope data agar query tidak terlalu besar
- gunakan agregasi atau precompute jika volume data besar
- hindari request penuh saat hanya kebutuhan tampilan ringkas

## Strategi yang disarankan

### `staleTime`

Gunakan `staleTime` sesuai jenis query:

- data statis: lebih lama
- user/session: moderat
- realtime domain: pendek
- laporan agregat: pilih sesuai kebutuhan, biasanya lebih pendek untuk data yang sering berubah

### `refetchOnWindowFocus`

- relevan untuk data yang sering berubah
- dapat dimatikan atau dibatasi pada data yang kurang kritis
- jangan digunakan serampangan untuk semua query tanpa pertimbangan performa

### Query key

Setiap query harus punya `queryKey` yang jelas dan scoped.

Contoh:

- `['me']`
- `['students']`
- `['attendance', date, classId]`
- `['report', filters]`

Tujuan:

- cache tidak bertabrakan
- debug query lebih mudah
- invalidation bisa diprediksi

## Tindakan optimisasi yang direkomendasikan

- Review query besar di dashboard dan halaman report
- Gunakan pengambilan data yang lebih spesifik sesuai filter
- Hindari memuat seluruh data jika hanya sebagian dibutuhkan
- Kurangi jumlah query yang berulang untuk data yang sama
- Gunakan aggregasi backend untuk data yang sering digunakan di dashboard

## Area utama yang perlu diperiksa di repo

- `src/router.tsx`
- `src/lib/queries.ts`
- halaman dashboard dan report
- halaman list data besar seperti siswa, absensi, tugas, dan nilai

## Checklist penerapan

- [ ] Query data utama punya `staleTime` yang sesuai kategori data
- [ ] Query key berscope jelas dan konsisten
- [ ] Query besar di dashboard/report sudah di-audit
- [ ] Tidak ada over-fetching pada list data yang bisa dipadatkan
- [ ] Data realtime hanya digunakan untuk kebutuhan yang memang real-time
- [ ] Cache invalidation konsisten saat state berubah

## Kesimpulan

Strategi cache query yang jelas adalah kunci untuk menjaga performa aplikasi tanpa mengorbankan real-time integrity. Dengan pendekatan yang terukur, aplikasi EduAbsen dapat tetap responsif saat data bertambah dan pengguna makin banyak.
