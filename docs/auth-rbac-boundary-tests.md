# Boundary Test untuk Auth dan RBAC

Dokumen ini menjelaskan strategi pengujian boundary untuk autentikasi dan role-based access control (RBAC) pada aplikasi EduAbsen.

## Tujuan

1. Memastikan route dan fitur hanya bisa diakses sesuai role yang valid.
2. Menjamin login, logout, dan session handling konsisten.
3. Mencegah regresi keamanan saat perubahan fitur atau route dilakukan.
4. Menetapkan checklist pengujian untuk admin, guru, dan siswa.

## Area yang harus diuji

### 1. Login dan session

Uji skenario berikut:
- user dengan kredensial valid berhasil login
- user dengan kredensial invalid gagal login
- user yang tidak login diarahkan ke `/login`
- user yang session expired langsung diarahkan ke login
- logout membersihkan cookie/session dan cache user

### 2. Route guard

Uji skenario berikut:
- admin dapat mengakses route admin
- guru dapat mengakses route guru tertentu
- siswa tidak dapat mengakses route admin atau route guru yang sensitif
- route yang dilarang mengarahkan ke home sesuai role

### 3. Role-based access control

Pada level fitur, pastikan:
- admin bisa mengakses master data dan pengaturan
- guru bisa mengakses absensi, tugas, nilai, dan laporan yang relevan
- siswa hanya bisa mengakses dashboard siswa, tugas mereka, dan data nilai milik mereka
- route yang tidak sesuai role menolak akses dan mengembalikan redirect atau error yang aman

### 4. Password change flow

Uji skenario berikut:
- user yang harus ganti password diarahkan ke `/settings`
- flow perubahan password berhasil dan sesi lama tidak lagi valid
- route utama tidak bisa diakses jika password belum diganti

## Boundary test yang disarankan

### Admin

- masuk ke dashboard admin
- mengakses route siswa, kelas, guru, mapel, setting
- mencoba akses route siswa yang tidak relevan jika bukan admin
- validasi bahwa fitur admin tidak terbuka untuk user lain

### Guru

- masuk ke dashboard guru
- mengakses absensi, tugas, nilai, laporan kelas
- mencoba akses route yang hanya admin, seperti master data sensitif atau pengaturan sekolah
- validasi bahwa akses dibatasi sesuai role

### Siswa

- masuk ke dashboard siswa
- mengakses tugas, absensi pribadi, nilai diri sendiri
- mencoba akses route admin/guru
- validasi redirect ke home sesuai role

## Strategi pengujian

### Unit / component-level

Uji logic guard dan redirect dengan penyedia context minimal.

Contoh assert:
- `requireUser` mengembalikan redirect jika user tidak ada
- `allowRoles` memblokir akses berdasarkan role
- `homeFor` mengembalikan route yang benar untuk siswa dan non-siswa

### Integration / route-level

Uji route utama dengan user session yang berbeda.

Contoh:
- admin -> `/dashboard` berhasil
- siswa -> `/dashboard` redirect ke `/my-attendance`
- guru -> `/students` boleh diakses atau tidak sesuai kebijakan app

### E2E

Untuk alur utama, lakukan test end-to-end untuk:
- login success/failure
- redirect setelah login
- access denied untuk role yang tidak punya izin
- logout flow
- password change flow

## Checklist penerapan

- [ ] Login valid dan invalid dipastikan tercakup
- [ ] Route guard di setiap role diuji
- [ ] Redirect home sesuai role ditest
- [ ] Logout dan session invalidation diuji
- [ ] Password change flow diuji
- [ ] Admin, guru, dan siswa punya test boundary yang berbeda
- [ ] Tidak ada route sensitif yang bisa diakses tanpa validasi role

## Kesimpulan

Boundary test untuk auth dan RBAC adalah prasyarat penting agar aplikasi edukasi tetap aman dan konsisten. Dengan pengujian yang jelas di setiap role, perubahan fitur tidak akan membuka celah akses yang tidak diinginkan.
