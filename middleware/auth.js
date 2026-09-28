// Middleware untuk melindungi endpoint khusus admin.
// Hanya request yang session-nya sudah ditandai isAdmin=true yang lolos.
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  return res.status(401).json({ ok: false, message: 'Belum login sebagai admin.' });
}

module.exports = { requireAdmin };
