# ImmersionTrack Windows Background Agent & AnkiConnect

Companion Agent ini berjalan di background Windows dan otomatis mendeteksi aplikasi/media yang sedang aktif (MPV, VLC, Anki, YouTube, Netflix, Manga, Visual Novel, Podcast), lalu mengirim sesi belajarnya ke web **ImmersionTrack** secara otomatis lewat `http://127.0.0.1:41937`.

## 1. Cara Menjalankan
- **Via terminal:**
  ```powershell
  npm run tracker
  ```
- **Via klik ganda (terlihat jendelanya):**
  Klik ganda `companion\start-tracker.bat`
- **Berjalan diam-diam di background (tanpa jendela terminal):**
  Klik ganda `companion\start-hidden.vbs`

## 2. Jalankan Otomatis Saat Windows Menyala (Opsional)
1. Tekan `Win + R`, ketik `shell:startup`, lalu tekan Enter.
2. Buat shortcut ke file `companion\start-hidden.vbs` di dalam folder Startup tersebut.

## 3. Setup AnkiConnect
1. Buka aplikasi **Anki** di PC.
2. Buka **Tools → Add-ons → Get Add-ons...**
3. Masukkan kode **`2055492159`** lalu restart Anki.
4. Selama Companion Agent aktif, web ImmersionTrack bisa langsung terhubung ke AnkiConnect tanpa perlu mengubah konfigurasi CORS secara manual.
