const jwt = require('jsonwebtoken');
const userRoleModel = require('../models/userRoleModel');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: SUPABASE_JWT_SECRET is not set in .env');
  process.exit(1);
}

/**
 * Extract and verify a Supabase JWT from the Authorization header.
 *
 * On success, attaches the decoded token payload to req.user:
 *   - req.user.sub  → Supabase auth.users UUID
 *   - req.user.id   → alias for sub (convenience)
 *   - req.user.email
 *   - req.user.role → Supabase role claim (e.g. "authenticated")
 *   - req.user.roles → application-level roles from user_roles table
 */
async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required — missing or malformed Authorization header', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token expired — please sign in again'
          : 'Invalid authentication token';
      console.warn(`[AUTH] JWT verification failed: ${err.name} — ${err.message}`);
      throw new AppError(message, 401);
    }

    if (!decoded.sub) {
      console.warn('[AUTH] JWT missing sub claim');
      throw new AppError('Invalid token payload', 401);
    }

    const roles = await userRoleModel.findByUserId(decoded.sub);

    req.user = {
      sub: decoded.sub,
      id: decoded.sub,
      email: decoded.email || null,
      role: decoded.role || 'authenticated',
      roles: roles.map((r) => r.role),
    };

    next();
  } catch (err) {
    if (!err.statusCode) {
      console.error('[AUTH] Unexpected error during authentication:', err.message);
    }
    next(err);
  }
}

/**
 * Must be used after requireAuth.
 * Rejects with 403 unless the authenticated user holds the 'admin' role.
 */
function requireAdmin(req, _res, next) {
  if (!req.user || !req.user.roles.includes('admin')) {
    console.warn(`[AUTH] Admin access denied for user ${req.user?.id || 'unknown'}`);
    return next(new AppError('Admin access required', 403));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
