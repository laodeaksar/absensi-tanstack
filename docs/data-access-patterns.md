# Pola Akses Data yang Distandarisasi

Dokumen ini menetapkan pola akses data yang dipakai di aplikasi EduAbsen agar konsisten di seluruh modul.

## Prinsip dasar

1. Data publik dan non-sensitif dipakai melalui query layer frontend.
2. Data yang memerlukan session, auth, atau validasi server dipakai melalui server function.
3. Mutasi data selalu melalui server-side validation dan tidak dijalankan langsung dari UI tanpa guard.
4. Data realtime hanya dipakai untuk kebutuhan yang memang memerlukan pembaruan instan.

## Mekanisme akses data

| Mekanisme | Dipakai untuk | Lokasi |
| --- | --- | --- |
| Realtime Convex (`convexQuery`, auth JWT) | Daftar dan detail ringan yang perlu live: siswa, kelas, guru, dashboard | `src/lib/queries.ts` |
| Query RPC (`api.*` → `queryRoute`) | Form yang sedang diedit (absensi, penilaian), laporan dan rekap besar, `me` dan pengaturan publik untuk guard SSR | `queries.ts` + `api.ts` + `convex.server.ts` |
| Mutasi (`api.*` → `mutationRoute`) | Semua perubahan data, dengan token sesi dari server | `api.ts` + `convex.server.ts` |
| Server function | Sesi, login/logout, penerbitan JWT | `src/server/functions.ts` |

## Aturan keamanan

- Otorisasi (`requireAuth`, peran, kepemilikan) wajib ada di setiap fungsi Convex.
  Query realtime menembus langsung ke Convex, jadi server function bukan batas keamanan.
- `allowRoles` dan guard rute hanya untuk pengalaman pengguna, bukan keamanan.
- Token sesi tidak pernah ke browser. JWT Convex jangka pendek boleh.
- Query yang berat atau dihitung dari banyak tabel memakai RPC, bukan realtime.

## Checklist fitur baru

- [ ] Fungsi Convex memanggil `requireAuth` dengan opsi peran yang tepat
- [ ] Mutasi atau query RPC didaftarkan di `convex.server.ts` dan `api.ts`
- [ ] Query berat atau form yang diedit pengguna memakai RPC (`staleTime: 0`)
- [ ] `invalidateQueries` hanya untuk query RPC, tidak perlu untuk `convexQuery`
- [ ] Query key RPC memakai prefiks `qk.*` agar mudah diinvalidasi