# 🍗 Portal Rekrutmen — Hisana Fried Chicken Cirebon

Website portal rekrutmen kerja Hisana Fried Chicken Cirebon dengan antarmuka modern, sistem formulir pendaftaran online untuk pelamar Pria & Wanita, dashboard HRD interaktif, ekspor data ke Excel, dan integrasi pemanggilan wawancara via WhatsApp.

---

## 🔍 Solusi Masalah CSS Tidak Tampil di VPS

Jika sebelumnya CSS tidak tampil saat dijalankan di VPS, hal tersebut disebabkan oleh beberapa faktor umum pada server Linux / VPS yang kini telah **diperbaiki secara tuntas**:

1. **Strict MIME Type & Safe 404 Handler:**  
   Sebelumnya jika rute statis tidak cocok, Express mengembalikan `index.html` (MIME: `text/html`). Browser modern memblokir stylesheet jika MIME type-nya adalah `text/html`. Kini Express telah dikonfigurasi dengan handler eksplisit `/css` dan `/js` yang memaksa `Content-Type: text/css; charset=UTF-8` dan `nosniff`, serta 404 handler tidak akan pernah mengirimkan HTML untuk file aset statis.
2. **Helmet Content Security Policy (CSP):**  
   Helmet default memblokir font eksternal dan mencoba memaksa protokol HTTPS (`upgrade-insecure-requests`), sehingga saat diakses melalui IP VPS HTTP (`http://<IP_VPS>:3000`), CSS dan Font diblokir browser. Kini CSP telah diatur agar fleksibel dan ramah VPS.
3. **Penyatuan Struktur Root & Host Binding:**  
   Aplikasi kini berada langsung di root project (bukan bersarang di dalam subfolder), dan server binding ke host `0.0.0.0` sehingga dapat diakses langsung dari IP publik VPS.
4. **Fallback CSS:**  
   Seluruh halaman HTML mendukung path absolut (`/css/style.css`) maupun relatif (`css/style.css`), dilengkapi gaya dasar inline.

---

## 🚀 Panduan Setup & Menjalankan di Lokal

1. **Install Dependensi:**
   ```bash
   npm install
   ```
2. **Siapkan File `.env`:**
   ```bash
   cp .env.example .env
   ```
3. **Buat Password Hash untuk Admin:**
   ```bash
   node hash-password.js "PasswordRahasiaAnda"
   ```
   Salin string `ADMIN_PASSWORD_HASH=...` yang dihasilkan ke dalam file `.env`.
4. **Jalankan Aplikasi:**
   ```bash
   npm start
   ```
   Buka di browser:
   - Pelamar: `http://localhost:3000`
   - Panel Admin: `http://localhost:3000/admin.html`

---

## 🌐 Panduan Deploy ke VPS (Ubuntu / Debian)

### 1. Hubungkan Repository ke GitHub / GitLab
Di komputer lokal Anda, buat repository baru di GitHub/GitLab, lalu jalankan:
```bash
git remote add origin https://github.com/USERNAME/hisana-fried-chicken.git
git branch -M main
git push -u origin main
```

### 2. Setup di VPS Pertama Kali
Login ke VPS via SSH, lalu jalankan:
```bash
# Update paket & pastikan Node.js 18+ serta Git terpasang
sudo apt update && sudo apt install -y git curl

# Install Node.js 20 LTS (jika belum ada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (Process Manager standar industri)
sudo npm install -g pm2

# Clone repository ke folder VPS
cd /var/www
sudo git clone https://github.com/USERNAME/hisana-fried-chicken.git hisana
cd hisana

# Install dependensi
npm install --omit=dev

# Buat file konfigurasi .env
cp .env.example .env
nano .env   # Isi ADMIN_PASSWORD_HASH & SESSION_SECRET
```

### 3. Jalankan Aplikasi dengan PM2
```bash
# Berikan izin eksekusi pada script deploy
chmod +x deploy.sh

# Jalankan server dengan PM2
pm2 start ecosystem.config.js --env production

# Pastikan PM2 otomatis menyala saat VPS restart
pm2 save
pm2 startup
```

### 4. Konfigurasi Nginx (Reverse Proxy & Port 80 / 443)
Salin template konfigurasi Nginx yang sudah disediakan:
```bash
sudo cp nginx-hisana.conf /etc/nginx/sites-available/hisana
sudo nano /etc/nginx/sites-available/hisana  # Sesuaikan domain Anda
sudo ln -s /etc/nginx/sites-available/hisana /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Pasang SSL Gratis (HTTPS) dengan Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
*Setelah SSL aktif, Anda dapat mengubah `FORCE_HTTPS=true` di file `.env`.*

---

## 🔄 Cara Update Web di VPS (Super Mudah!)

Setiap kali Anda melakukan perubahan di komputer lokal:
1. Simpan perubahan dan commit di lokal:
   ```bash
   git add .
   git commit -m "update: pembaruan fitur"
   git push
   ```
2. Di terminal VPS Anda, cukup jalankan **1 perintah**:
   ```bash
   cd /var/www/hisana
   ./deploy.sh
   ```
   Script `deploy.sh` akan otomatis menarik kode terbaru (`git pull`), memperbarui dependensi, dan me-reload server Node.js dengan **zero-downtime**!

---

## ✨ Fitur-Fitur Utama

- **Desain Premium Brand Hisana:** Skema warna khas Hisana (Crispy Golden Amber & Flame Red), tipografi Plus Jakarta Sans, responsif untuk smartphone & desktop.
- **Kategori Khusus Pria & Wanita:** Persyaratan yang disesuaikan dan indikator status pendaftaran real-time (Dibuka / Ditutup).
- **Formulir Interaktif:** Validasi otomatis nomor WhatsApp (+62 / 08), deteksi formasi lamaran, dan konfirmasi pengiriman tiket pelamar.
- **Panel Admin HRD:**
  - KPI ringkasan (Total pelamar, Pria, Wanita, Hari ini).
  - Saklar pembuka/penutup lowongan seketika.
  - Pencarian dan filter pelamar instan.
  - Modal detail profil lengkap pelamar.
  - Tombol **Direct WhatsApp Chat** berformat pesan undangan wawancara resmi.
  - Download seluruh berkas lamaran ke format Microsoft Excel (`.xlsx`).
