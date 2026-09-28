require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const db = require('./db');
const apiRoutes = require('./routes/api');

// Inisialisasi penyimpanan database lokal
db.init();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';
const forceHttps = process.env.FORCE_HTTPS === 'true';

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[PERINGATAN] SESSION_SECRET belum diset di .env. Menggunakan nilai default dev (ganti untuk production).'
  );
}

// Diperlukan saat berada di belakang reverse proxy seperti Nginx, Caddy, Cloudflare, Traefik
app.set('trust proxy', 1);

// Konfigurasi Helmet yang ramah VPS & kompatibel dengan IP / domain tanpa SSL
// CSP yang terlalu ketat sering memblokir CSS / Font saat diakses langsung lewat IP VPS HTTP
const enableStrictCsp = process.env.ENABLE_STRICT_CSP === 'true';

if (enableStrictCsp) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: forceHttps ? [] : null,
        },
      },
      strictTransportSecurity: forceHttps,
    })
  );
} else {
  // Mode default yang aman namun fleksibel: tidak memblokir stylesheet, font, atau aset CDN
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity: false,
    })
  );
}

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());

// Konfigurasi Session
app.use(
  session({
    name: 'hisana.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-hisana-cirebon-2024-secure-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Hanya paksa cookie secure jika HTTPS benar-benar aktif
      secure: forceHttps,
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
    },
  })
);

// -------------------------------------------------------------
// SERVING FILE STATIS DENGAN HEADER MIME KETAT (SOLUSI CSS VPS)
// -------------------------------------------------------------
// Seringkali di VPS, Nginx atau reverse proxy salah menyajikan MIME type
// atau fallback 404 mengembalikan HTML sehingga browser memblokir CSS:
// "Refused to apply style because its MIME type ('text/html') is not supported"
// Handler eksplisit di bawah ini menjamin CSS & JS selalu dikirim dengan MIME type yang benar!

const publicDir = path.resolve(__dirname, 'public');

// Handler eksplisit untuk folder CSS
app.use('/css', express.static(path.join(publicDir, 'css'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  },
  maxAge: isProduction ? '1d' : 0,
}));

// Handler eksplisit untuk folder JS
app.use('/js', express.static(path.join(publicDir, 'js'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  },
  maxAge: isProduction ? '1d' : 0,
}));

// Routing file statis umum (index.html, apply.html, admin.html, favicon, dll)
app.use(express.static(publicDir, {
  index: ['index.html'],
  dotfiles: 'ignore',
  etag: true,
  maxAge: isProduction ? '1h' : 0,
}));

// Endpoint API
app.use('/api', apiRoutes);

// Endpoint Health Check (sangat berguna untuk VPS monitoring / PM2 / Docker)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Hisana Fried Chicken Recruitment Portal',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// -------------------------------------------------------------
// 404 HANDLER YANG AMAN
// -------------------------------------------------------------
// PENTING: Jangan kembalikan HTML untuk file aset (.css, .js, .png, dll) yang hilang!
// Jika request .css hilang dan dikembalikan HTML, browser akan error MIME type!
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, message: 'Endpoint API tidak ditemukan.' });
  }

  // Jika yang dicari adalah aset statis tapi tidak ada
  if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json)$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('Aset tidak ditemukan: ' + req.path);
  }

  // Fallback untuk route halaman (SPA / Halaman Statis)
  res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

// Jalankan Server pada HOST 0.0.0.0 agar dapat diakses dari IP VPS langsung
app.listen(PORT, HOST, () => {
  console.log('========================================================');
  console.log('🍗 HISANA FRIED CHICKEN - PORTAL LAMARAN KERJA CIREBON 🍗');
  console.log(`🚀 Server aktif di: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`🌐 Akses dari luar (VPS): http://<IP_VPS_ANDA>:${PORT}`);
  console.log(`📁 Static Root: ${publicDir}`);
  console.log(`🔒 Mode: ${process.env.NODE_ENV || 'development'} | Force HTTPS: ${forceHttps}`);
  console.log('========================================================');
});
