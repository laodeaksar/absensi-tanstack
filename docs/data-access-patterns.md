# Pola Akses Data yang Distandarisasi

Dokumen ini menetapkan pola akses data yang dipakai di aplikasi EduAbsen agar konsisten di seluruh modul.

## Prinsip dasar

1. Data publik dan non-sensitif dipakai melalui query layer frontend.
2. Data yang memerlukan session, auth, atau validasi server dipakai melalui server function.
3. Mutasi data selalu melalui server-side validation dan tidak dijalankan langsung dari UI tanpa guard.
4. Data realtime hanya dipakai untuk kebutuhan yang memang memerlukan pembaruan instan.

## Kategori akses data

### 1. Query publik / non-authenticated

Gunakan pola `queryOptions` dengan `convexQuery` atau query yang aman untuk data yang tidak memerlukan user context.

Contoh:
- settings publik
- data referensi umum
- halaman yang tidak membutuhkan user login

Lokasi utama:
- `src/lib/queries.ts`

Aturan:
- tidak boleh membaca data sensitif atau user-specific
- tidak boleh mengandalkan cookie/session browser secara langsung
- harus punya key query yang stabil dan terdokumentasi

### 2. Query authenticated / user-specific

Gunakan server function untuk menjaga validasi session dan keamanan.

Contoh:
- `getMeFn`
- `getConvexJwtFn`
- `getPublicSettingsFn` saat perlu validasi session

Lokasi utama:
- `src/server/functions.ts`

Aturan:
- semua akses yang terkait session, password, role, dan user context harus lewat server
- token tidak dikirim ke browser secara langsung untuk penggunaan sensitif
- redirect/auth failure harus ditangani di layer server dan query client

### 3. Mutasi data

Semua perubahan data harus melewati server-side validation.

Aturan:
- UI tidak langsung menulis ke database
- semua mutation harus divalidasi di backend sebelum persetujuan perubahan
- mutation kritikal harus memeriksa role dan ownership data
- semua error auth atau authorization harus ditangani oleh layer backend dan frontend secara konsisten

### 4. Realtime subscription

Pakai subscription hanya bila data perlu diperbarui secara real-time di UI.

Aturan:
- gunakan untuk modul yang memang butuh update instan seperti absensi, tugas, nilai, relasi data yang sering berubah
- hindari subscription berlebihan untuk data statis atau laporan besar yang tidak memerlukan update real-time
- selalu batasi query dan payload agar tidak memicu beban yang tidak perlu

## Patokan keputusan

Gunakan tabel keputusan berikut:

- Data publik dan tidak sensitif → query layer
- Data yang membutuhkan session → server function
- Data yang mengubah state sistem → mutation/server validation
- Data yang perlu update instan → realtime subscription
- Data yang sensitif atau berhubungan dengan auth → server-only

## Implementasi yang disarankan di repo

- Frontend query: `src/lib/queries.ts`
- Session/auth logic: `src/server/functions.ts`
- Route guard dan role authorization: `src/lib/auth.ts` dan `src/routes/_app.tsx`
- Router cache/auth handling: `src/router.tsx`

## Checklist penerapan

- [ ] Query data baru diletakkan di `src/lib/queries.ts` jika tidak memerlukan session
- [ ] Akses authenticated diletakkan di `src/server/functions.ts`
- [ ] Mutation selalu melewati server validation
- [ ] Query key diberi scoping yang jelas
- [ ] Data realtime hanya untuk kebutuhan yang memang real-time
- [ ] Tidak ada perubahan data kritis dari UI tanpa guard server

## Kesimpulan

Pola ini memastikan aplikasi tetap aman, konsisten, dan mudah dipelihara. Semua developer harus mengikuti pola ini untuk fitur baru agar tidak terjadi fragmentasi akses data di masa depan.
