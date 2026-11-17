# Konsistensi Domain Model dan Data

Dokumen ini menetapkan kebijakan agar data di aplikasi EduAbsen memiliki definisi yang jelas, satu sumber kebenaran, dan relasi yang konsisten antar domain.

## Prinsip utama

1. Setiap domain bisnis harus memiliki satu sumber kebenaran yang jelas.
2. Data kritis tidak boleh dikelola di lebih dari satu tempat dengan interpretasi berbeda.
3. Relasi antar tabel harus terdokumentasi dan mudah diverifikasi.
4. Setiap perubahan data harus mengikuti aturan validasi domain masing-masing.

## Domain utama yang harus dipahami

### 1. Auth & session

Domain ini mencakup:
- user
- session
- login attempt
- role
- auth state

Sumber kebenaran:
- `users` untuk profil dan role
- `sessions` untuk token aktif
- `login_attempts` untuk status lockout

Aturan:
- role dan status aktivitas harus konsisten dengan data user aktif
- session tidak boleh dianggap valid jika user sudah tidak aktif atau password diubah
- logout dan invalidation harus membersihkan cache session dan state auth frontend

### 2. Master data

Domain ini mencakup:
- siswa
- kelas
- guru
- pengampu
- mapel
- riwayat kelas siswa

Sumber kebenaran:
- `students` untuk identitas siswa
- `classes` untuk definisi kelas
- `student_class_history` untuk riwayat kelas
- `teaching` dan `subjects` untuk pengampu dan mata pelajaran

Aturan:
- status aktif siswa harus dibedakan dengan riwayat kelasnya
- data kelas harus tetap konsisten dengan tingkat dan tahun ajaran
- riwayat kelas tidak boleh diprediksi dari data kelas terbaru saja

### 3. Attendance

Domain ini mencakup:
- absensi harian
- absensi per mata pelajaran
- ringkasan harian

Sumber kebenaran:
- `attendance` untuk catatan absensi harian
- `subject_attendance` untuk absensi mata pelajaran
- `attendance_daily` untuk agregasi ringkas

Aturan:
- ringkasan harian harus selalu konsisten dengan catatan detail
- status kehadiran harus memakai nilai yang terdokumentasi dan seragam
- perubahan data absensi harus mengikuti validasi tanggal dan role

### 4. Assignment & grading

Domain ini mencakup:
- tugas
- soal
- jawaban siswa
- nilai
- KKM dan komponen penilaian

Sumber kebenaran:
- `assignments` untuk metadata tugas
- `questions` untuk soal
- `submissions` / data jawaban untuk hasil siswa
- data nilai dan konfigurasi KKM tersimpan di tabel domain penilaian yang relevan

Aturan:
- status tugas, tenggat waktu, dan publikasi harus konsisten
- nilai tidak boleh diproses dari data yang belum final
- konfigurasi KKM dan bobot nilai harus ada satu interpretasi yang valid

### 5. Settings & operational config

Domain ini mencakup:
- pengaturan sekolah
- konfigurasi tahun ajaran
- status aktif aplikasi
- parameter operasional

Sumber kebenaran:
- tabel `settings` dan parameter strategis yang dipakai di modul terkait

Aturan:
- konfigurasi tidak boleh tumpang tindih antar modul
- default dan override harus terdokumentasi
- perubahan setting harus memengaruhi semua konsumen yang memakai value tersebut

## Kebijakan source of truth

Untuk data kritis, berikut aturan yang harus dipatuhi:

- Profil user: `users`
- Session aktif: `sessions`
- Lockout login: `login_attempts`
- Data siswa: `students`
- Data kelas: `classes`
- Riwayat kelas siswa: `student_class_history`
- Absensi harian: `attendance`
- Absensi mapel: `subject_attendance`
- Data tugas: `assignments`
- Data soal: `questions`
- Data publik sekolah: `settings`

Jika suatu data muncul di lebih dari satu tabel, harus ada dokumentasi yang jelas mengapa demikian dan apa yang menjadi sumber kebenaran utama.

## Relasi dan integritas data

### Aturan relasi

- Tidak semua referensi boleh dibuat sebagai string yang tidak divalidasi.
- Setiap referensi antar tabel harus memiliki kontrak jelas mengenai asal data dan kapan data valid.
- Nilai yang berasal dari domain lain harus dipastikan dapat diverifikasi sebelum digunakan.

### Audit yang perlu dilakukan

- Identifikasi field yang mereferensikan ID antar tabel.
- Pastikan referensi valid untuk domain utama.
- Pastikan rules bisnis tidak bergantung pada asumsi yang tidak terdokumentasi.
- Validasi bahwa status aktif, role, dan kategori siswa/guru tidak tumpang tindih.

## Domain boundary yang disarankan

Pembagian domain berikut dianjurkan agar codebase lebih jelas:

- `auth`
- `master-data`
- `attendance`
- `teaching`
- `assignments`
- `grades`
- `reports`
- `settings`

Satu domain tidak boleh membaca atau memodifikasi state domain lain tanpa kontrak jelas.

## Checklist penerapan

- [ ] Setiap domain punya source of truth yang jelas
- [ ] Data yang terdampak di domain lain sudah terdokumentasi
- [ ] Relasi antar tabel diverifikasi terhadap id dan validitas status
- [ ] Aturan bisnis utama tidak tersebar tanpa dokumentasi
- [ ] Perubahan pada data kritis memerlukan validasi domain yang sesuai
- [ ] Domain dengan status kompleks (kelas, riwayat, absensi, nilai) memiliki definisi yang konsisten

## Kesimpulan

Konsistensi domain model adalah fondasi agar aplikasi EduAbsen tetap aman dan siap berkembang. Tanpa model data yang jelas, sistem dengan banyak role, data kelas, absensi, tugas, dan nilai akan rentan terhadap inkonsistensi dan bug bisnis yang sulit dilacak.
