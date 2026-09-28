const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const rateLimit = require('express-rate-limit');

const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Batasi percobaan login supaya tidak mudah dibrute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
});

// Batasi submit lamaran supaya tidak dibanjiri spam/bot.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Terlalu banyak pengiriman dari perangkat ini. Coba lagi nanti.' },
});

// ---------- PUBLIC: status lamaran (buka/tutup) ----------
router.get('/status', (req, res) => {
  const settings = db.getSettings();
  res.json({ ok: true, status: settings });
});

// ---------- PUBLIC: submit lamaran ----------
// Catatan: sengaja TIDAK memakai .escape() di sini. Data disimpan apa adanya
// (setelah divalidasi panjang & formatnya) supaya tidak muncul ganda saat
// di-escape ulang oleh frontend (tabel admin) atau saat dibuka di Excel.
// Perlindungan XSS dilakukan saat MENAMPILKAN data (lihat public/js/admin.js
// yang selalu memakai textContent, bukan menyisipkan HTML mentah).
const submitValidators = [
  body('jenisKelamin').isIn(['pria', 'wanita']).withMessage('Jenis kelamin tidak valid.'),
  body('namaLengkap').trim().isLength({ min: 3, max: 100 }),
  body('tempatTanggalLahir').trim().isLength({ min: 3, max: 100 }),
  body('alamat').trim().isLength({ min: 5, max: 300 }),
  body('noHp').trim().matches(/^[0-9+\-\s]{8,20}$/).withMessage('Nomor HP tidak valid.'),
  body('email').trim().isEmail().withMessage('Email tidak valid.').normalizeEmail(),
  body('pendidikanTerakhir').trim().isLength({ min: 2, max: 100 }),
  body('posisiDilamar').trim().isLength({ min: 2, max: 100 }),
  body('statusPernikahan').trim().isLength({ min: 2, max: 50 }),
  body('ketersediaan').trim().isLength({ min: 2, max: 100 }),
  body('pengalamanKerja').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  body('alasanMelamar').trim().isLength({ min: 5, max: 1000 }),
];

router.post('/submit', submitLimiter, submitValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, message: 'Data tidak valid.', errors: errors.array() });
  }

  const settings = db.getSettings();
  const gender = req.body.jenisKelamin;
  if (!settings[gender]) {
    return res.status(403).json({ ok: false, message: 'Lamaran untuk kategori ini sedang ditutup.' });
  }

  const entry = {
    id: crypto.randomUUID(),
    jenisKelamin: gender,
    namaLengkap: req.body.namaLengkap,
    tempatTanggalLahir: req.body.tempatTanggalLahir,
    alamat: req.body.alamat,
    noHp: req.body.noHp,
    email: req.body.email,
    pendidikanTerakhir: req.body.pendidikanTerakhir,
    posisiDilamar: req.body.posisiDilamar,
    statusPernikahan: req.body.statusPernikahan,
    ketersediaan: req.body.ketersediaan,
    pengalamanKerja: req.body.pengalamanKerja || '-',
    alasanMelamar: req.body.alasanMelamar,
    submittedAt: new Date().toISOString(),
  };

  db.addSubmission(entry);
  res.json({ ok: true, message: 'Lamaran berhasil dikirim. Terima kasih!' });
});

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

    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) {
      return res.status(500).json({
        ok: false,
        message: 'ADMIN_PASSWORD_HASH belum diset di file .env. Jalankan node hash-password.js dulu.',
      });
    }

    const ok = bcrypt.compareSync(req.body.password, hash);
    if (!ok) {
      return res.status(401).json({ ok: false, message: 'Password salah.' });
    }

    req.session.isAdmin = true;
    res.json({ ok: true });
  }
);

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/admin/session', (req, res) => {
  res.json({ ok: true, isAdmin: !!(req.session && req.session.isAdmin) });
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

router.delete('/admin/submissions/:id', requireAdmin, (req, res) => {
  const removed = db.deleteSubmission(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, message: 'Data tidak ditemukan.' });
  res.json({ ok: true });
});

// ---------- ADMIN: export Excel ----------
router.get('/admin/export', requireAdmin, async (req, res) => {
  const all = db.listSubmissions().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hisana Fried Chicken Cirebon';
  const sheet = workbook.addWorksheet('Lamaran');

  sheet.columns = [
    { header: 'Tanggal Kirim', key: 'submittedAt', width: 20 },
    { header: 'Jenis Kelamin', key: 'jenisKelamin', width: 14 },
    { header: 'Nama Lengkap', key: 'namaLengkap', width: 25 },
    { header: 'Tempat, Tgl Lahir', key: 'tempatTanggalLahir', width: 25 },
    { header: 'Alamat', key: 'alamat', width: 35 },
    { header: 'No HP', key: 'noHp', width: 18 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Pendidikan Terakhir', key: 'pendidikanTerakhir', width: 20 },
    { header: 'Posisi Dilamar', key: 'posisiDilamar', width: 20 },
    { header: 'Status Pernikahan', key: 'statusPernikahan', width: 16 },
    { header: 'Ketersediaan', key: 'ketersediaan', width: 20 },
    { header: 'Pengalaman Kerja', key: 'pengalamanKerja', width: 35 },
    { header: 'Alasan Melamar', key: 'alasanMelamar', width: 35 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF97316' }, // oranye, senada tema brand
  };

  all.forEach((s) => {
    sheet.addRow({
      ...s,
      submittedAt: new Date(s.submittedAt).toLocaleString('id-ID'),
      jenisKelamin: s.jenisKelamin === 'pria' ? 'Pria' : 'Wanita',
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="lamaran-hisana-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
