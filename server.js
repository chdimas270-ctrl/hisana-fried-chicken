require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const db = require('./db');
const apiRoutes = require('./routes/api');

db.init();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[PERINGATAN] SESSION_SECRET belum diset di .env. Menggunakan nilai default yang TIDAK aman untuk production.'
  );
}

app.set('trust proxy', 1); // perlu jika di-deploy di belakang reverse proxy (Railway, Render, Nginx, dll)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: null, // null untuk benar-benar menonaktifkan upgrade-insecure-requests di Helmet
      },
    },
    // Nonaktifkan HSTS sampai HTTPS diaktifkan via Certbot
    strictTransportSecurity: false,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

app.use(
  session({
    name: 'hisana.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-jangan-dipakai-di-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // wajib HTTPS saat production
      maxAge: 1000 * 60 * 60 * 4, // 4 jam
    },
  })
);

app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hisana Fried Chicken - Lamaran Kerja berjalan di http://localhost:${PORT}`);
});
