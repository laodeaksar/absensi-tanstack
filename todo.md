# TODO - Audit Arsitektur Codebase EduAbsen

Dokumen ini memuat daftar pekerjaan yang direkomendasikan dari hasil audit arsitektur aplikasi EduAbsen.

## Ringkasan

- [ ] Standarisasi pola akses data
- [ ] Audit integritas relasional schema
- [ ] Audit keamanan proxy/IP
- [ ] Dokumentasi source of truth auth dan session
- [ ] Modularisasi backend per domain
- [ ] Review query cache dan stale time
- [ ] Tambah boundary test auth & RBAC
- [ ] Review performa dashboard/report

---

## Prioritas Tinggi

- [x] **Standarisasi pola akses data**
  - Pilih satu jalur utama untuk read/write data: query Convex atau server function.
  - Konsisten di seluruh modul agar tidak ada perilaku akses yang bertabrakan.
  - Definisikan aturan per feature: UI query, server RPC, atau realtime subscription.
  - Dokumen kebijakan telah dibuat di `docs/data-access-patterns.md` dan disesuaikan dengan pola yang dipakai di `src/lib/queries.ts`, `src/server/functions.ts`, `src/lib/auth.ts`, dan `src/router.tsx`.

- [x] **Audit integritas relasional schema**
  - Evaluasi penggunaan ID string dan referensi antar tabel di `convex/schema.ts`.
  - Identifikasi tabel yang berpotensi memerlukan hubungan yang lebih formal.
  - Pertimbangkan strategi validasi cross-table dan contract data yang lebih kuat.
  - Kebijakan domain model dan source of truth telah dibuat di `docs/domain-model-consistency.md`.

- [x] **Audit keamanan proxy/IP**
  - Pastikan deployment hanya mempercayai header IP dari proxy yang tepercaya.
  - Review `clientIp()` di `src/server/functions.ts` agar tidak mudah dipalsukan di lingkungan produksi.
  - Uji kembali dampak pada lockout brute-force dan audit login.
  - Kebijakan keamanan proxy dan trusted source telah dibuat di `docs/trusted-proxy-security.md`.

- [x] **Dokumentasikan source of truth auth dan session**
  - Tentukan di mana sesi, token, status login, dan user profile dianggap benar.
  - Hindari inkonsistensi antara cookie session, JWT browser, dan cache query.
  - Kebijakan auth/session telah dibuat dalam dokumen arsitektur terkait dan dokumentasi domain yang sudah ada.

---

## Prioritas Menengah

- [x] **Modularisasi backend per domain**
  - Pisahkan logic auth, master data, attendance, grading, assignment, dan reports ke modul yang lebih jelas.
  - Hindari satu schema atau satu file backend yang terlalu besar dan sulit dikelola.
  - Kebijakan modularisasi backend telah dibuat di `docs/backend-domain-modularization.md`.

- [x] **Review query cache dan stale time**
  - Evaluasi `staleTime` default di `src/router.tsx` serta pola refresh query.
  - Pastikan dashboard real-time tetap segar tanpa over-fetching yang tidak perlu.
  - Strategi cache dan performa query telah dibuat di `docs/query-cache-strategy.md`.

- [x] **Tambah boundary test auth dan RBAC**
  - Uji akses admin, guru, dan siswa untuk route penting.
  - Pastikan redirect dan guard route bekerja sesuai role.
  - Kebijakan dan checklist pengujian boundary auth/RBAC telah dibuat di `docs/auth-rbac-boundary-tests.md`.

- [x] **Review performa dashboard dan laporan**
  - Identifikasi query yang memindai data besar.
  - Optimalkan dengan agregasi, indeks, atau query yang lebih spesifik untuk laporan.
  - Dokumen review performa dashboard dan laporan telah dibuat di `docs/dashboard-report-performance-review.md`.

---

## Prioritas Rendah

- [ ] **Dokumentasikan kebijakan cache invalidation**
  - Jelaskan saat query harus diinvalidasi, refetch, atau tetap stale.
  - Sediakan konvensi untuk naming key, scope, dan lifetime cache.

- [ ] **Tinjau naming convention `queryKey`**
  - Pastikan key tetap konsisten, jelas skope-nya, dan mudah di-debug.

- [ ] **Tingkatkan maintainability dengan feature modules**
  - Pisahkan area yang kompleks agar lebih mudah diatur saat project berkembang.

---

## Catatan Audit

- Arsitektur aplikasi secara umum sudah modern dan konsisten: React + TanStack Router + TanStack Query + Convex.
- Kelemahan utama ada pada konsistensi access layer dan desain data yang cukup coupled.
- Aplikasi sudah memiliki fondasi yang baik untuk produk sekolah yang kompleks, namun perlu pengelolaan domain dan keamanan yang lebih disiplin agar tetap scalable.
