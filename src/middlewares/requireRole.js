const logger = require('../utils/logger');

// Must run after verifyJwt (needs req.user already set).
// Usage: router.get('/admin/x', verifyJwt, requireRole('admin'), controller);
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logger.warn(
        `RBAC denied - user=${req.user ? req.user.id : 'anonymous'} role=${req.user ? req.user.role : 'none'} required=${allowedRoles.join(',')} ${req.method} ${req.originalUrl}`
      );
      if (req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ error: { message: 'Forbidden.' } });
      }
      return res.status(403).render('pages/error', {
        title: 'Forbidden - CommunityConnect',
        status: 403,
        message: 'Forbidden — you do not have access to this page.',
      });
    }
    next();
  };
}

module.exports = { requireRole };
