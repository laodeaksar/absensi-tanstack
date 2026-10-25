# EduAbsen - TanStack Start

Frontend + server-function layer untuk backend Apps Script yang sudah ada.

```
Browser  ->  TanStack Start (server functions)  ->  Apps Script Web App (doPost)  ->  Google Sheets
```

Token sesi disimpan di **cookie httpOnly** oleh server Start dan disisipkan otomatis
ke setiap panggilan; browser tidak pernah memegang token (tidak lagi di localStorage).

## Stack

| Kebutuhan | Paket |
|---|---|
| Framework | `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-router-ssr-query` |
| Query / mutation | `@tanstack/react-query` |
| Form | `@tanstack/react-form` |
| Tabel | `@tanstack/react-table` (v9: `useTable`, `tableFeatures`) |
| Chart | `@tanstack/charts` (`@tanstack/charts/react`, `/polar`) |
| UI | Tailwind v4 + daisyUI 5 + lucide-react |

## Instalasi

```sh
pnpm install   # lalu tambahkan dependensi di bawah (package.json sengaja tanpa versi)

pnpm add @tanstack/react-start @tanstack/react-router @tanstack/react-router-ssr-query \
  @tanstack/react-query @tanstack/react-form @tanstack/react-table @tanstack/charts \
  react react-dom zod lucide-react daisyui

pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node \
  tailwindcss @tailwindcss/vite
```

## Konfigurasi

1. Salin `.env.example` menjadi `.env`, isi `APPS_SCRIPT_URL` dan `API_SECRET`.
2. Di Apps Script: tambahkan `apps-script/Api.gs`, set Script Property `API_SECRET`
   (nilai sama dengan `.env`), hapus `doGet` lama + `Index.html`, lalu deploy Web App
   (Execute as: Me, Who has access: Anyone). Setiap perubahan kode = New version.
3. `pnpm dev` -> http://localhost:3000. File `src/routeTree.gen.ts` dibuat otomatis.

## Struktur

```
src/
  router.tsx            QueryClient + router + penanganan AUTH_FAILED global
  server/
    gas.server.ts       fetch ke Apps Script (hanya server)
    functions.ts        loginFn, logoutFn, getMeFn, gasRpc (RPC berdaftar-putih)
  lib/                  api, queries (queryOptions), table (fitur v9), auth guard, toast
  components/           ui (Modal, DataTable, field form), charts, Toaster
  routes/
    login.tsx
    _app.tsx            layout + guard login (ssr: false)
    _app/               dashboard, students, classes, teachers,
                        attendance, reports, my-attendance, settings
```

## Pemetaan dari versi lama

- `google.script.run` -> `gasRpc` (server fn) -> `api.*` -> `queryOptions` / `useMutation`
- Validasi form manual -> `@tanstack/react-form` (validator sama untuk onChange dan onSubmit)
- Tabel HTML + `filterTable` -> `useTable` (sorting + pagination), pencarian di luar tabel
- Chart.js -> `@tanstack/charts` (bar berkelompok + donat lewat `pie` + `radialArc`)
- Filter absensi/laporan -> search params URL (bisa di-bookmark)
- Edit siswa/kelas ditambahkan (modal yang sama dengan tambah)

## Catatan

- `@tanstack/charts` dan Table v9 masih baru; jika ada prop yang tidak lolos typecheck,
  cocokkan dengan dokumentasi versi yang terpasang.
- Area login memakai `ssr: false` (SPA): bergantung pada cookie sesi dan tanggal lokal.
  Halaman `/login` tetap SSR.
- Pindah kelas siswa belum ada di backend (`saveStudent` hanya menaruh siswa ke kelas saat dibuat).
- Deploy: pilih target hosting Start (Netlify, Vercel, Cloudflare, Node/Nitro) dan set
  `APPS_SCRIPT_URL` + `API_SECRET` sebagai environment variable server.