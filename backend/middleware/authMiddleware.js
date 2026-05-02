const { supabaseAdmin, supabaseFromToken } = require('../config/supabase');
const { AppError } = require('./errorHandler');

/**
 * Extract and verify a Supabase JWT from the Authorization header.
 *
 * Validation is delegated to the Supabase JS client (`auth.getUser`) which
 * handles both legacy HS256 and current asymmetric (ES256/RS256) tokens
 * via the project's JWKS endpoint. This is the recommended approach as of
 * Supabase's 2025 asymmetric JWT migration.
 *
 * On success, attaches:
 *   - req.user.sub  → Supabase auth.users UUID
 *   - req.user.id   → alias for sub (convenience)
 *   - req.user.email
 *   - req.user.role → Supabase role claim (e.g. "authenticated")
 *   - req.user.roles → application-level roles from public.user_roles
 *   - req.token     → raw JWT, for forwarding to per-request Supabase clients
 */
async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication required — missing or malformed Authorization header',
        401
      );
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      const msg = error?.message || 'Invalid authentication token';
      const isExpired = /expired|jwt expired/i.test(msg);
      console.warn(`[AUTH] Token verification failed: ${msg}`);
      throw new AppError(
        isExpired ? 'Token expired — please sign in again' : 'Invalid authentication token',
        401
      );
    }

    const supaUser = data.user;
    const userClient = supabaseFromToken(token);
    const { data: roleRows, error: roleErr } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', supaUser.id);

    if (roleErr) {
      console.error(`[AUTH] Failed to load roles for ${supaUser.id}: ${roleErr.message}`);
      throw new AppError('Failed to resolve user roles', 500);
    }

    req.user = {
      sub: supaUser.id,
      id: supaUser.id,
      email: supaUser.email || null,
      role: supaUser.role || 'authenticated',
      roles: (roleRows || []).map((r) => r.role),
    };
    req.token = token;

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
