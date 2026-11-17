# Keamanan Request dan Trusted Proxy

Dokumen ini mendefinisikan kebijakan keamanan terkait identitas klien yang didapat dari header HTTP, khususnya pada aplikasi EduAbsen yang dipasang di belakang reverse proxy atau load balancer.

## Prinsip dasar

1. Header IP klien tidak boleh diperlakukan sebagai sumber kebenaran yang aman jika request datang dari jaringan yang tidak dipercaya.
2. Aplikasi hanya boleh menerima IP dari reverse proxy atau edge layer yang telah dikonfigurasi sebagai trusted endpoint.
3. Header seperti `x-forwarded-for` dan `x-real-ip` harus diproses dengan hati-hati dan bukan sebagai satu-satunya mekanisme keamanan.
4. Layanan keamanan seperti brute-force protection dan audit logging harus mengandalkan IP yang telah diberi trust model yang jelas.

## Risiko yang perlu dihindari

Jika aplikasi secara langsung mempercayai header client IP tanpa validasi proxy, maka:

- klien dapat memalsukan header IP,
- kontrol lockout login bisa rusak,
- log aktivitas menjadi tidak dapat dipercaya,
- sistem keamanan dapat dipelintir untuk melakukan bypass atau manipulasi.

## Kebijakan yang disarankan

### 1. Trusted proxy only

Aplikasi hanya boleh membaca IP klien dari request yang berasal dari proxy atau edge layer yang tepercaya.

Aturan:

- Jika request datang dari jaringan yang tidak tepercaya, aplikasi tidak boleh mempercayai `x-forwarded-for`.
- Gunakan environment atau konfigurasi deployment untuk menetapkan proxy yang trusted.
- Hindari menerima header IP dari client yang terhubung langsung ke aplikasi tanpa reverse proxy.

### 2. Header yang digunakan harus dibatasi

Gunakan header yang jelas dan aman, misalnya:

- `x-forwarded-for` jika request benar-benar berasal dari trusted proxy
- `x-real-ip` jika platform proxy menyediakan informasi yang konsisten

Jangan mempercayai variabel header secara umum tanpa validasi jaringan dan topologi deployment.

### 3. IP adalah alat keamanan, bukan satu-satunya mekanisme

IP bisa dipakai untuk:

- rate limiting,
- audit log,
- brute-force lockout,
- analitik trafik.

Namun IP tidak boleh menjadi satu-satunya lapisan keamanan. Untuk autentikasi utama tetap gunakan session, token, dan validasi server yang benar.

### 4. Implementasi harus transparan dan terdokumentasi

Setiap environment harus memiliki definisi yang jelas:

- apakah aplikasi berdiri di belakang reverse proxy,
- proxy mana yang terpercaya,
- header mana yang diizinkan,
- bagaimana fallback bila header tidak ada atau tidak valid.

## Implementasi yang disarankan di repo

Fungsi `clientIp()` di `src/server/functions.ts` harus diperlakukan sebagai helper yang bergantung pada trust model deployment. Pola yang aman:

- validasi apakah request datang dari trusted proxy,
- gunakan header tertentu hanya bila trust model terpenuhi,
- jika tidak, fallback ke value kosong atau tindakan aman,
- catat event saat IP tidak valid atau tidak dapat dipercaya.

## Checklist keamanan

- [ ] Proxy atau load balancer yang berada di depan aplikasi sudah terdokumentasi
- [ ] Header IP yang diterima hanya berasal dari trusted source
- [ ] `x-forwarded-for` hanya digunakan ketika trust model valid
- [ ] Lockout brute-force tidak mengandalkan IP yang bisa dipalsukan
- [ ] Log keamanan dan audit event menggunakan IP yang aman dan konsisten
- [ ] Environment production dan staging memiliki konfigurasi proxy yang jelas

## Kesimpulan

Keamanan request harus didasarkan pada trust boundary yang jelas. Aplikasi tidak boleh menerima header IP dari klien tanpa validasi proxy, karena ini dapat merusak audit keamanan, lockout login, dan seluruh sistem kontrol akses berbasis jaringan.
