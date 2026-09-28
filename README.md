# Lamaran Kerja — Hisana Fried Chicken Cirebon

Website lamaran kerja sederhana: 2 kartu (Pria / Wanita) di halaman depan,
panel admin untuk buka/tutup lamaran, lihat data, dan download Excel.

## Cara Menjalankan (Lokal)

1. Install Node.js versi 18 ke atas.
2. Buka folder project ini di terminal, lalu jalankan:
   ```bash
   npm install
   ```
3. Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
4. Buat password admin (jangan pakai password lemah/tebakan seperti "admin123"):
   ```bash
   node hash-password.js "PasswordRahasiaAnda"
   ```
   Salin hasil `ADMIN_PASSWORD_HASH=...` yang muncul ke file `.env`.
5. Isi `SESSION_SECRET` di `.env` dengan string acak panjang (boleh generate di
   https://randomkeygen.com atau jalankan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
6. Jalankan server:
   ```bash
   npm start
   ```
7. Buka `http://localhost:3000` di browser.
   - Halaman utama pelamar: `http://localhost:3000`
   - Panel admin: `http://localhost:3000/admin.html`

## Deploy ke Hosting (Publik)

Karena berupa aplikasi Node.js biasa, bisa dijalankan di layanan seperti
Railway, Render, VPS, atau cPanel yang mendukung Node.js. Yang wajib disiapkan
di server produksi:

- Set environment variable `SESSION_SECRET` dan `ADMIN_PASSWORD_HASH` (jangan
  simpan password asli di mana pun).
- Set `NODE_ENV=production` supaya cookie sesi admin dipaksa hanya lewat HTTPS.
- Pastikan domain Anda menggunakan HTTPS (wajib, supaya sesi admin & data
  pelamar tidak bisa disadap saat lewat jaringan).
- Folder `data/` berisi `submissions.json` — inilah database lamaran Anda.
  **Backup folder ini secara berkala** dan jangan biarkan folder ini bisa
  diakses langsung lewat URL (secara default sudah tidak bisa, karena hanya
  folder `public/` yang disajikan sebagai file statis).

## Keamanan yang Sudah Diterapkan

- Password admin disimpan sebagai **hash bcrypt**, bukan teks biasa.
- Sesi admin memakai cookie `httpOnly` (tidak bisa dibaca lewat JavaScript
  di browser) dan `secure` saat production (wajib HTTPS).
- Endpoint `/api/admin/*` (lihat data, hapus data, export Excel, buka/tutup
  lamaran) diproteksi middleware — hanya bisa diakses setelah login admin.
- Semua input dari pelamar divalidasi & dibersihkan (`express-validator`)
  untuk mencegah data sampah dan serangan injeksi sederhana.
- Rate limiting: percobaan login dibatasi 10x/15 menit, pengiriman lamaran
  dibatasi 20x/jam per perangkat, untuk mencegah brute-force dan spam bot.
- HTTP security headers lewat `helmet` (CSP, dsb).

## Batasan yang Perlu Anda Tahu

- Data disimpan di file JSON, cukup untuk skala 1 outlet. Kalau volume lamaran
  sangat besar dan butuh banyak admin mengakses bersamaan, sebaiknya upgrade
  ke database seperti PostgreSQL/MySQL.
- Tidak ada fitur upload foto/CV di formulir ini (sesuai permintaan agar tetap
  simpel). Bisa ditambahkan kalau diperlukan.
- Backup `data/submissions.json` secara rutin — jika file/server hilang tanpa
  backup, data lamaran ikut hilang.

## Struktur Folder

```
hisana-app/
├── server.js              # entry point aplikasi
├── db.js                  # penyimpanan data (JSON file)
├── hash-password.js       # utilitas bikin hash password admin
├── routes/api.js          # semua endpoint API
├── middleware/auth.js     # proteksi endpoint admin
├── public/
│   ├── index.html         # halaman depan (2 kartu)
│   ├── apply.html         # formulir lamaran
│   ├── admin.html         # panel admin
│   ├── css/style.css
│   └── js/{apply,admin}.js
└── data/                  # dibuat otomatis saat pertama kali dijalankan
```
