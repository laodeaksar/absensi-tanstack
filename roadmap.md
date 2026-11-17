# Roadmap Implementasi Arsitektur EduAbsen

Dokumen ini berisi roadmap teknis untuk memperkuat arsitektur aplikasi berdasarkan hasil audit. Fokusnya adalah stabilitas, konsistensi data, keamanan, dan skalabilitas.

---

## Fase 1 - Stabilisasi Fondasi (1-2 minggu)

### Tujuan

Mengamankan fondasi aplikasi dan mengurangi risiko operasional sebelum menambah fitur baru.

### Pekerjaan

- [x] Standarisasi pola akses data
  - Tentukan jalur utama untuk query dan mutation.
  - Batasi penggunaan akses langsung yang tidak konsisten.
  - Dokumen kebijakan telah dibuat di `docs/data-access-patterns.md`.
- [x] Audit dan hardening auth/session
  - Validasi cookie sesi HTTP-only.
  - Review JWT browser lifecycle.
  - Pastikan logout, invalidation, dan redirect konsisten.
  - Source-of-truth auth/session telah dibahas dalam dokumentasi arsitektur terkait.
- [x] Review trusted proxy dan IP logging
  - Konfigurasi header yang dipercaya.
  - Validasi lockout login dan audit security event.
  - Kebijakan keamanan proxy telah dibuat di `docs/trusted-proxy-security.md`.

### Deliverable

- Dokumentasi pola akses data
- Catatan keamanan deployment
- SOP auth/session handling

### Acceptance Criteria

- Tidak ada ambiguitas pola akses data untuk feature baru.
- Login/logout/session invalidation konsisten di semua route.
- Header proxy aman berdasarkan konfigurasi hosting yang dipercaya.

---

## Fase 2 - Konsistensi Data dan Domain Model (2-3 minggu)

### Tujuan

Mengurangi coupling data dan meningkatkan integritas model bisnis.

### Pekerjaan

- [x] Audit model relasional di `convex/schema.ts`
  - Identifikasi tabel dengan referensi string yang perlu validasi manual.
  - Tambahkan kontrak validasi untuk hubungan domain utama.
  - Kebijakan domain model dan source of truth telah dituangkan di `docs/domain-model-consistency.md`.
- [x] Definisikan source of truth untuk data kritis
  - User session
  - Profil user
  - Data sekolah/settings
  - Status presensi dan nilai
- [x] Dokumentasi aturan bisnis inti
  - Peran admin, guru, siswa
  - Status kehadiran
  - KKM dan penilaian
  - Kenaikan kelas dan kelulusan

### Deliverable

- Dokumen model data domain
- Panduan rules/business logic
- Checklist integritas data untuk modul utama

### Acceptance Criteria

- Referensi antar data tidak bergantung pada asumsi yang tidak terdokumentasi.
- Tim punya pemahaman yang sama terhadap business rules utama.
- Perubahan pada domain tidak memicu bug karena ketidakjelasan source of truth.

---

## Fase 3 - Modularisasi Backend (3-4 minggu)

### Tujuan

Membuat codebase lebih mudah dipelihara saat fitur bertambah.

### Pekerjaan

- [x] Pisahkan modul backend per domain
  - auth
  - master data
  - attendance
  - assignment
  - grading
  - reports
  - settings
  - Kebijakan modularisasi backend telah dibuat di `docs/backend-domain-modularization.md`.
- [x] Pindahkan logic terkait domain ke file/module terpisah
- [x] Definisikan boundary dan API contract antar modul

### Deliverable

- Struktur backend modular
- Dokumentasi boundary modul
- Reducer/contract untuk setiap domain

### Acceptance Criteria

- Setiap domain memiliki ownership yang jelas.
- Perubahan pada satu modul tidak menyebabkan impact besar ke modul lain.
- Tim dapat bekerja paralel tanpa banyak collision code.

---

## Fase 4 - Optimasi Query, Cache, dan Performansi (2 minggu)

### Tujuan

Meningkatkan responsivitas aplikasi dan mengurangi overhead data untuk dashboard serta laporan.

### Pekerjaan

- [x] Review query cache dan `staleTime`
- [x] Audit query besar di dashboard dan report
- [x] Tambahkan indeks/aggregasi yang relevan di backend jika perlu
- [x] Optimalkan payload untuk list/table besar
- Review performa dashboard dan laporan telah dibuat di `docs/dashboard-report-performance-review.md`.

### Deliverable

- Laporan optimasi query
- Strategy cache untuk modul utama

### Acceptance Criteria

- Dashboard dan laporan tetap cepat saat data bertambah.
- Query besar tidak memicu beban berlebihan pada frontend/backend.
- Data yang ditampilkan konsisten dengan state yang sedang aktif.

---

## Fase 5 - Quality Gates dan Governance (1-2 minggu)

### Tujuan

Menjamin aplikasi tetap sehat setelah perubahan arsitektur.

### Pekerjaan

- [x] Tambah boundary tests auth & RBAC
- [x] Review e2e untuk alur utama admin/guru/siswa
- [x] Menetapkan coding standard dan review checklist
- [x] Dokumentasikan release readiness checklist
- Kebijakan boundary test auth/RBAC telah dibuat di `docs/auth-rbac-boundary-tests.md`.
- Governance dan quality gate telah dibuat di `docs/architecture-governance-checklist.md`.

### Deliverable

- Test suite relevan untuk keamanan dan akses
- Checklist review PR
- SOP deployment/rollback

### Acceptance Criteria

- Setiap perubahan kritikal diuji di boundary penting.
- Tim dapat review pull request dengan konsistensi yang lebih baik.
- Risiko regressi berkurang secara signifikan.

---

## Prioritas Eksekusi

### Prioritas 1

1. Standarisasi pola akses data
2. Audit auth/session security
3. Audit schema relasional/data integrity

### Prioritas 2

4. Modularisasi backend
5. Review cache dan query performance
6. Boundary tests & RBAC

### Prioritas 3

7. Quality gates dan governance
8. Optimasi lanjutan berdasarkan telemetry real usage

---

## Estimasi Waktu

- Fase 1: 1-2 minggu
- Fase 2: 2-3 minggu
- Fase 3: 3-4 minggu
- Fase 4: 2 minggu
- Fase 5: 1-2 minggu

Total estimasi: sekitar 9-14 minggu untuk stabilisasi arsitektur inti dan peningkatan maintainability.

---

## Catatan

Roadmap ini didasarkan pada hasil audit arsitektur aplikasi EduAbsen yang mencakup frontend, backend Convex, session/auth, dan query layer. Fokus utama saat ini bukan penambahan fitur baru, melainkan memastikan aplikasi siap untuk tumbuh secara aman dan terukur.
