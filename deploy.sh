#!/bin/bash
set -e

echo "🍗 ==============================================="
echo "🍗 UPDATE PORTAL REKRUTMEN HISANA FRIED CHICKEN"
echo "🍗 ==============================================="

# 1. Tarik pembaruan kode terbaru dari Git
echo "📥 [1/4] Menarik kode terbaru dari Git repository..."
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    git pull
else
    echo "⚠️  Bukan git repository atau remote belum diset."
fi

# 2. Install dependensi produksi
echo "📦 [2/4] Memeriksa & menginstall dependensi npm..."
npm install --omit=dev

# 3. Pastikan direktori database data/ tersedia
echo "📁 [3/4] Menyiapkan folder data..."
mkdir -p data

# 4. Restart aplikasi menggunakan PM2 (Zero Downtime)
echo "🔄 [4/4] Memuat ulang aplikasi..."
if command -v pm2 > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
    pm2 save
    echo "✅ Aplikasi berhasil dimuat ulang dengan PM2!"
else
    echo "ℹ️  PM2 tidak terdeteksi. Silakan jalankan manual: npm start"
fi

echo "==============================================="
echo "🎉 Update selesai! Website siap digunakan."
echo "==============================================="
