/**
 * src/middleware/permissions.js
 * Control de acceso granular por permisos (empleados).
 * Admin siempre tiene acceso total sin consultar la BD.
 */
import { databasePool } from '../config/database.js';

/**
 * Lista blanca de columnas de permiso. Es la ÚNICA fuente de nombres que
 * puede llegar a la consulta SQL (los identificadores no se pueden parametrizar).
 */
export const PERMISOS_VALIDOS = Object.freeze([
  'puede_ventas',
  'puede_inventario',
  'puede_compras',
  'puede_clientes',
  'puede_reportes'
]);

/**
 * Middleware factory: verifica que el usuario tenga el permiso requerido.
 * Admin pasa siempre. Empleado se verifica en tabla permisos.
 *
 * Uso: requirePermiso('puede_ventas')
 * Siempre después de requireAuth.
 *
 * @throws {Error} al definir la ruta si el permiso no está en la lista blanca.
 */
export function requirePermiso(permiso, pool = databasePool) {
  if (!PERMISOS_VALIDOS.includes(permiso)) {
    throw new Error(`Permiso desconocido: "${permiso}"`);
  }

  return async (request, response, next) => {
    try {
      // Admin tiene todos los permisos siempre
      if (request.user?.role === 'admin') return next();

      const userId = request.user?.sub;
      if (userId === undefined || userId === null) {
        return response.status(401).json({ message: 'Usuario no autenticado.' });
      }

      // ?? = identificador escapado por mysql2 (doble protección junto a la whitelist)
      const [rows] = await pool.query(
        'SELECT ?? AS permitido FROM permisos WHERE id_usuario = ?',
        [permiso, userId]
      );

      if (rows.length === 0 || !rows[0].permitido) {
        return response.status(403).json({
          message: 'No tienes permiso para realizar esta acción.'
        });
      }

      return next();
    } catch {
      return response.status(500).json({ message: 'Error verificando permisos.' });
    }
  };
}