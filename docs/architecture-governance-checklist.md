# Checklist Governance Arsitektur dan Quality Gates

Dokumen ini menetapkan kontrol kualitas dan tata kelola arsitektur agar aplikasi EduAbsen tetap aman, konsisten, dan mudah dipelihara saat berkembang.

## Tujuan

1. Menjaga kualitas perubahan arsitektur dan fitur.
2. Mengurangi risiko regresi pada alur utama aplikasi.
3. Menetapkan standar review pull request yang konsisten.
4. Menjamin security, auth, dan data integrity tetap terjaga.

## Area yang harus diperiksa sebelum merge

### 1. Security & auth

- [ ] Tidak ada perubahan yang membuka route tanpa validasi auth.
- [ ] Role dan permission diperiksa sesuai kebutuhan fitur.
- [ ] Session, token, dan cookie diperlakukan dengan benar.
- [ ] Header atau request context yang sensitif tidak dipakai tanpa trust model yang jelas.

### 2. Data integrity

- [ ] Domain data memiliki source of truth yang jelas.
- [ ] Relasi antar tabel atau ID string terdokumentasi.
- [ ] Validasi input mengikuti aturan domain masing-masing.
- [ ] Tidak ada state kritis yang dikelola di lebih dari satu tempat tanpa kontrak.

### 3. Query & cache

- [ ] Query key jelas dan ber-scope.
- [ ] `staleTime` dan invalidation sesuai tipe data.
- [ ] Query besar dan dashboard tidak mengembalikan payload yang tidak perlu.
- [ ] Data realtime dipakai hanya untuk kebutuhan yang memang real-time.

### 4. Backend modularity

- [ ] Logic dipisahkan sesuai domain.
- [ ] Boundary antar modul terdokumentasi.
- [ ] Tidak ada logic bisnis yang tersebar tanpa owner yang jelas.
- [ ] API contract domain jelas dan konsisten.

### 5. Testing

- [ ] Boundary test auth/RBAC dibuat untuk perubahan akses.
- [ ] Flow kritis seperti login, logout, dan password change terbukti aman.
- [ ] UI test atau integration test dibuat untuk fitur yang mengalami perubahan besar.
- [ ] Perubahan data penting dilengkapi dengan validation atau regression check.

## Review checklist untuk PR

Setiap pull request harus diperiksa terhadap hal berikut:

- [ ] Apakah perubahan ini memengaruhi auth/session/role?
- [ ] Apakah perubahan ini memengaruhi data model atau relasi utama?
- [ ] Apakah perubahan ini menambah query atau payload yang tidak perlu?
- [ ] Apakah perubahan ini memengaruhi dashboard atau report besar?
- [ ] Apakah perubahan ini cocok dengan pola arsitektur yang sudah disepakati?
- [ ] Apakah perubahan sudah divalidasi dengan test yang relevan?

## Release readiness checklist

Sebelum deploy ke production, pastikan:

- [ ] Semua gate security sudah relevan dan lulus.
- [ ] Role access dan route guard sudah teruji.
- [ ] Data kritis dan konfigurasi utama sudah diverifikasi.
- [ ] Query besar dan dashboard sudah di-audit untuk performa.
- [ ] Dokumentasi kebijakan arsitektur sudah sesuai dengan implementasi.
- [ ] Tidak ada bug pada alur utama admin, guru, dan siswa.

## Kesimpulan

Governance arsitektur dan quality gate adalah mekanisme penting untuk menjaga kualitas aplikasi ketika project tumbuh. Dengan checklist yang konsisten, perubahan kecil tetap aman, dan arsitektur tetap dapat dipelihara dengan lebih baik.
