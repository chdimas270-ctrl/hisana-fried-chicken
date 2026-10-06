// Middleware untuk melindungi endpoint khusus admin.
// Mendukung session memori dan signed cookie (tahan banting di lingkungan serverless seperti Vercel).
function requireAdmin(req, res, next) {
  const isSessionAdmin = req.session && req.session.isAdmin === true;
  const isCookieAdmin = req.signedCookies && req.signedCookies.hisana_admin === '1';

  if (isSessionAdmin || isCookieAdmin) {
    if (req.session) {
      req.session.isAdmin = true;
    }
    return next();
  }
  return res.status(401).json({ ok: false, message: 'Belum login sebagai admin.' });
}

module.exports = { requireAdmin };
