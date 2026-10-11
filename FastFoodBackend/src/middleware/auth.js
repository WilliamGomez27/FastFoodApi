/**
 * src/middleware/auth.js
 * Autenticación JWT y control de acceso basado en roles (RBAC).
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Usuario ficticio inyectado cuando AUTH_DISABLED=true (solo development/test).
 * Tiene rol admin para poder probar todas las pantallas sin login.
 */
export const DEV_USER = Object.freeze({
  sub: 0,
  name: 'Dev (auth desactivada)',
  email: 'dev@localhost',
  role: 'admin'
});

/**
 * Genera un token JWT firmado con el payload dado.
 */
export function createToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Middleware: Verifica que el request incluya un Bearer token válido.
 * Si es válido, adjunta los datos del usuario a `request.user`.
 *
 * Si AUTH_DISABLED=true (y solo en development/test, validado en env.js),
 * omite la verificación e inyecta DEV_USER. Para reactivar la autenticación
 * basta con poner AUTH_DISABLED=false; no hay que tocar código.
 */
export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (env.authDisabled) {
    // Si llega un token válido, se respeta (permite probar roles reales).
    if (token) {
      try {
        request.user = jwt.verify(token, env.jwtSecret);
        return next();
      } catch {
        // Token inválido en modo dev → se ignora y se usa DEV_USER
      }
    }
    request.user = { ...DEV_USER };
    return next();
  }

  if (!token) {
    return response.status(401).json({ message: 'Token de autenticación requerido.' });
  }

  try {
    request.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware factory: Control de Acceso Basado en Roles (RBAC).
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 *
 * Uso: requireRole('admin') — solo admins
 *      requireRole('admin', 'manager') — admins o managers
 *
 * IMPORTANTE: Siempre debe usarse DESPUÉS de requireAuth en la cadena.
 * Ejemplo: app.delete('/recurso', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    // requireAuth ya verificó y adjuntó request.user
    const userRole = request.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return response.status(403).json({
        message: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}.`
      });
    }

    return next();
  };
}