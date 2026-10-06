const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// -----------------------------------------------------------------------------
// KONFIGURASI KEAMANAN UPLOAD BERKAS (ZERO-TRUST MODEL)
// -----------------------------------------------------------------------------
// 1. Simpan berkas di luar folder 'public/' agar TIDAK BISA diakses langsung via URL.
// 2. Berkas hanya bisa dibuka/diunduh oleh Admin HRD terautentikasi.
// 3. Nama file di-generate acak (UUID) untuk mencegah Path Traversal (../../).
// 4. Whitelist ketat: HANYA PDF, JPG, JPEG, PNG (Maksimal 5MB).
// 5. Ekstensi skrip (.js, .php, .html, .sh, .exe, dll) ditolak keras.
// -----------------------------------------------------------------------------

const UPLOAD_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.resolve(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[UPLOAD WARN] Gagal membuat folder uploads:', e.message);
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitasi dan buat nama acak dengan UUID
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    const fieldPrefix = (file.fieldname || 'doc').replace(/[^a-zA-Z0-9]/g, '');
    const uniqueFilename = `${fieldPrefix}-${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Tolak keras ekstensi berbahaya yang berpotensi web shell / executable
  const dangerousExts = [
    '.js', '.php', '.html', '.htm', '.svg', '.sh', '.exe',
    '.bat', '.cmd', '.py', '.ps1', '.jsp', '.cgi', '.phtml',
  ];
  if (dangerousExts.includes(ext)) {
    return cb(new Error('Format file berbahaya ditolak untuk keamanan sistem.'), false);
  }

  // Whitelist MIME type & Extension
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error('Format berkas tidak didukung! Hanya diperbolehkan file PDF, JPG, dan PNG.'),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per berkas
    files: 3, // 3 slot berkas
  },
});

const uploadFields = upload.fields([
  { name: 'suratLamaran', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
  { name: 'fotoKtp', maxCount: 1 },
]);

// Helper untuk menghapus berkas sementara jika validasi formulir gagal
function cleanupUploadedFiles(files) {
  if (!files) return;
  Object.values(files).forEach((fileArr) => {
    if (Array.isArray(fileArr)) {
      fileArr.forEach((f) => {
        if (f.path && fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {
            console.error('Gagal hapus file sementara:', e);
          }
        }
      });
    }
  });
}

// -----------------------------------------------------------------------------
// RATE LIMITER
// -----------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak pengiriman berkas dari perangkat ini. Silakan coba lagi nanti.' },
});

// ---------- PUBLIC: status lamaran (buka/tutup) ----------
router.get('/status', (req, res) => {
  const settings = db.getSettings();
  res.json({ ok: true, status: settings });
});

// ---------- PUBLIC: submit lamaran dengan berkas ----------
const submitValidators = [
  body('jenisKelamin').isIn(['pria', 'wanita']).withMessage('Jenis kelamin tidak valid.'),
  body('namaLengkap').trim().isLength({ min: 3, max: 100 }).withMessage('Nama lengkap minimal 3 karakter.'),
  body('usia')
    .isInt({ min: 19, max: 50 })
    .withMessage('Usia minimal adalah 19 tahun.'),
  body('domisili').trim().isLength({ min: 3, max: 300 }).withMessage('Domisili tempat tinggal wajib diisi.'),
  body('email').trim().isEmail().withMessage('Format email tidak valid.').normalizeEmail(),
  body('noWa')
    .trim()
    .matches(/^[0-9+\-\s]{8,20}$/)
    .withMessage('Nomor WhatsApp tidak valid.'),
  body('pengalamanKerja').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  body('referensi')
    .isIn(['Anggota Keluarga', 'Teman', 'Sosial Media'])
    .withMessage('Pilihan referensi tidak valid.'),
];

router.post(
  '/submit',
  submitLimiter,
  (req, res, next) => {
    uploadFields(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ ok: false, message: 'Ukuran berkas melebihi batas (maksimal 5MB per file).' });
        }
        return res.status(400).json({ ok: false, message: `Gagal mengunggah berkas: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ ok: false, message: err.message });
      }
      next();
    });
  },
  submitValidators,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        ok: false,
        message: 'Data formulir belum lengkap atau tidak valid.',
        errors: errors.array(),
      });
    }

    const settings = db.getSettings();
    const gender = req.body.jenisKelamin;
    if (!settings[gender]) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({ ok: false, message: 'Lowongan untuk kategori ini sedang ditutup.' });
    }

    // Validasi aturan bisnis posisi kerja:
    // Form perempuan HANYA Kasir, Form laki-laki HANYA Crew
    let posisiFixed = gender === 'wanita' ? 'Kasir' : 'Crew';

    // Verifikasi berkas minimal: CV dan Foto KTP wajib diunggah
    if (!req.files || !req.files.cv || !req.files.fotoKtp) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        ok: false,
        message: 'Mohon unggah CV dan Foto KTP Anda sebelum mengirim formulir.',
      });
    }

    // Bangun metadata berkas aman
    const filesMeta = {};
    if (req.files.suratLamaran && req.files.suratLamaran[0]) {
      const f = req.files.suratLamaran[0];
      filesMeta.suratLamaran = {
        originalName: path.basename(f.originalname).slice(0, 100),
        storedFilename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
      };
    }

    if (req.files.cv && req.files.cv[0]) {
      const f = req.files.cv[0];
      filesMeta.cv = {
        originalName: path.basename(f.originalname).slice(0, 100),
        storedFilename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
      };
    }

    if (req.files.fotoKtp && req.files.fotoKtp[0]) {
      const f = req.files.fotoKtp[0];
      filesMeta.fotoKtp = {
        originalName: path.basename(f.originalname).slice(0, 100),
        storedFilename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
      };
    }

    const entry = {
      id: crypto.randomUUID(),
      jenisKelamin: gender,
      namaLengkap: req.body.namaLengkap,
      usia: parseInt(req.body.usia, 10),
      domisili: req.body.domisili,
      email: req.body.email,
      noWa: req.body.noWa,
      posisiPekerjaan: posisiFixed,
      pengalamanKerja: req.body.pengalamanKerja || 'Belum memiliki pengalaman kerja (Fresh Graduate)',
      referensi: req.body.referensi,
      files: filesMeta,
      submittedAt: new Date().toISOString(),
    };

    await db.addSubmission(entry);

    // Simpan buffer berkas ke cloud database jika aktif (agar tidak hilang di serverless)
    if (req.files) {
      const savePromises = [];
      Object.values(req.files).forEach((fieldArr) => {
        if (Array.isArray(fieldArr) && fieldArr[0]) {
          const f = fieldArr[0];
          try {
            if (fs.existsSync(f.path)) {
              const buf = fs.readFileSync(f.path);
              savePromises.push(db.saveFile(f.filename, buf, f.mimetype, f.originalname));
            }
          } catch (e) {
            console.warn('[FILE SAVE WARN]', e.message);
          }
        }
      });
      if (savePromises.length > 0) {
        try {
          await Promise.all(savePromises);
        } catch (e) {
          console.warn('[FILE PROMISE WARN]', e.message);
        }
      }
    }

    res.json({ ok: true, message: 'Lamaran & berkas Anda berhasil dikirim. Terima kasih!' });
  }
);

// ---------- ADMIN: login/logout ----------
router.post(
  '/admin/login',
  loginLimiter,
  body('password').isString().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, message: 'Password wajib diisi.' });
    }

    let hash = (process.env.ADMIN_PASSWORD_HASH || '').trim().replace(/^['"]|['"]$/g, '').trim();
    if (!hash) {
      return res.status(500).json({
        ok: false,
        message: 'ADMIN_PASSWORD_HASH belum diset di .env. Jalankan node hash-password.js.',
      });
    }

    const inputPassword = String(req.body.password || '');
    let ok = false;
    try {
      ok = bcrypt.compareSync(inputPassword, hash);
    } catch (err) {
      console.error('[AUTH ERROR] Format hash tidak valid:', err.message);
    }

    if (!ok) {
      return res.status(401).json({ ok: false, message: 'Password salah.' });
    }

    req.session.isAdmin = true;
    res.cookie('hisana_admin', '1', {
      signed: true,
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true' || !!process.env.VERCEL,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
    });
    res.json({ ok: true });
  }
);

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('hisana.sid');
    res.clearCookie('hisana_admin');
    res.json({ ok: true });
  });
});

router.get('/admin/session', (req, res) => {
  const isAuth = !!(
    (req.session && req.session.isAdmin) ||
    (req.signedCookies && req.signedCookies.hisana_admin === '1')
  );
  res.json({ ok: true, isAdmin: isAuth });
});

// ---------- ADMIN: ringkasan statistik (KPI) ----------
router.get('/admin/stats', requireAdmin, (req, res) => {
  const submissions = db.listSubmissions();
  const settings = db.getSettings();
  const total = submissions.length;
  const pria = submissions.filter((s) => s.jenisKelamin === 'pria').length;
  const wanita = submissions.filter((s) => s.jenisKelamin === 'wanita').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const hariIni = submissions.filter(
    (s) => s.submittedAt && s.submittedAt.slice(0, 10) === todayStr
  ).length;

  res.json({
    ok: true,
    stats: {
      total,
      pria,
      wanita,
      hariIni,
      settings,
    },
  });
});

// ---------- ADMIN: buka/tutup lamaran ----------
router.post(
  '/admin/status',
  requireAdmin,
  body('pria').optional().isBoolean(),
  body('wanita').optional().isBoolean(),
  (req, res) => {
    const partial = {};
    if (typeof req.body.pria === 'boolean') partial.pria = req.body.pria;
    if (typeof req.body.wanita === 'boolean') partial.wanita = req.body.wanita;
    const updated = db.setSettings(partial);
    res.json({ ok: true, status: updated });
  }
);

// ---------- ADMIN: lihat data lamaran ----------
router.get('/admin/submissions', requireAdmin, (req, res) => {
  const all = db.listSubmissions().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  res.json({ ok: true, submissions: all });
});

// ---------- ADMIN: akses aman melihat/mengunduh berkas pelamar ----------
router.get('/admin/files/:filename', requireAdmin, async (req, res) => {
  // path.basename mutlak mencegah Path Traversal (../../)
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  const ext = path.extname(safeFilename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';

  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', contentType);
    return res.sendFile(filePath);
  }

  // Fallback dari Cloud Database (Vercel Serverless) jika file fisik di /tmp sudah ter-reset
  const cloudFile = await db.getFile(safeFilename);
  if (cloudFile && cloudFile.buffer) {
    res.setHeader('Content-Type', cloudFile.mimetype || contentType);
    let buf;
    if (Buffer.isBuffer(cloudFile.buffer)) {
      buf = cloudFile.buffer;
    } else if (cloudFile.buffer && cloudFile.buffer._bsontype === 'Binary' && typeof cloudFile.buffer.value === 'function') {
      buf = cloudFile.buffer.value(true);
    } else if (cloudFile.buffer && cloudFile.buffer.buffer) {
      buf = Buffer.from(cloudFile.buffer.buffer);
    } else if (cloudFile.buffer && typeof cloudFile.buffer.read === 'function') {
      buf = cloudFile.buffer.read(0, cloudFile.buffer.length());
    } else {
      buf = Buffer.from(cloudFile.buffer);
    }
    return res.send(buf);
  }

  return res.status(404).type('text/plain').send('Berkas tidak ditemukan.');
});

// ---------- ADMIN: hapus data lamaran & berkas terkait ----------
router.delete('/admin/submissions/:id', requireAdmin, (req, res) => {
  const candidate = db.getSubmission ? db.getSubmission(req.params.id) : null;
  if (candidate && candidate.files) {
    Object.values(candidate.files).forEach((fileObj) => {
      if (fileObj && fileObj.storedFilename) {
        const filePath = path.join(UPLOAD_DIR, path.basename(fileObj.storedFilename));
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Gagal menghapus berkas pelamar:', e);
          }
        }
      }
    });
  }

  const removed = db.deleteSubmission(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, message: 'Data tidak ditemukan.' });
  res.json({ ok: true });
});

// ---------- ADMIN: export Excel ----------
router.get('/admin/export', requireAdmin, async (req, res) => {
  const all = db.listSubmissions().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hisana Fried Chicken Cirebon';
  const sheet = workbook.addWorksheet('Data Pelamar');

  sheet.columns = [
    { header: 'Tanggal Kirim', key: 'submittedAt', width: 22 },
    { header: 'Kategori', key: 'jenisKelamin', width: 14 },
    { header: 'Nama Lengkap', key: 'namaLengkap', width: 28 },
    { header: 'Usia', key: 'usia', width: 10 },
    { header: 'Domisili Saat Ini', key: 'domisili', width: 35 },
    { header: 'Nomor WhatsApp', key: 'noWa', width: 18 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Posisi Pekerjaan', key: 'posisiPekerjaan', width: 16 },
    { header: 'Referensi Kerja', key: 'referensi', width: 22 },
    { header: 'Pengalaman Kerja', key: 'pengalamanKerja', width: 35 },
    { header: 'Surat Lamaran', key: 'hasSurat', width: 16 },
    { header: 'CV', key: 'hasCv', width: 16 },
    { header: 'Foto KTP', key: 'hasKtp', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF59E0B' }, // Hisana Amber
  };

  all.forEach((s) => {
    sheet.addRow({
      submittedAt: new Date(s.submittedAt).toLocaleString('id-ID'),
      jenisKelamin: s.jenisKelamin === 'pria' ? 'Pria' : 'Wanita',
      namaLengkap: s.namaLengkap,
      usia: s.usia ? `${s.usia} Thn` : '-',
      domisili: s.domisili || '-',
      noWa: s.noWa || s.noHp || '-',
      email: s.email,
      posisiPekerjaan: s.posisiPekerjaan || (s.jenisKelamin === 'pria' ? 'Crew' : 'Kasir'),
      referensi: s.referensi || '-',
      pengalamanKerja: s.pengalamanKerja || '-',
      hasSurat: s.files && s.files.suratLamaran ? 'Ada' : 'Tidak Ada',
      hasCv: s.files && s.files.cv ? 'Ada' : 'Tidak Ada',
      hasKtp: s.files && s.files.fotoKtp ? 'Ada' : 'Tidak Ada',
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="pelamar-hisana-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
