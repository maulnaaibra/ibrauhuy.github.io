# GOIC Backend Auth (`github.com/adhocore/goic`)

`adhocore/goic` adalah library OpenID Connect **backend Go** (Golang) dan tidak dapat berjalan langsung di GitHub Pages statis.

## Cara Menjalankan Server GOIC (Opsional)

1. Siapkan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` dari Google Cloud Console dengan Authorized Redirect URI menunjuk ke `<URL-SERVER-ANDA>/auth/o8/google`.
2. Jalankan:
   ```sh
   go mod tidy
   set GOOGLE_CLIENT_ID=...
   set GOOGLE_CLIENT_SECRET=...
   set FRONTEND_ORIGIN=https://nihongotracker.my.id
   go run .
   ```
3. Tempel URL endpoint `<URL-SERVER-ANDA>/auth/o8/google` pada pengaturan **GOIC Server** di tombol **Lanjutkan dengan Google** pada aplikasi web.
