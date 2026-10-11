/**
 * src/controllers/permissions.controller.js
 * Gestión de permisos granulares por usuario — solo admin.
 *
 * SEGURIDAD:
 * - Admin nunca puede perder sus permisos
 * - Nunca se asignan todos los permisos a un empleado sin confirmación explícita
 * - Body validado por schemas.permisos; :id_usuario por validateIdParams
 */
import { databasePool } from '../config/database.js';
import { PERMISOS_VALIDOS } from '../middleware/permissions.js';
import { normalizarPermisos } from './users.controller.js';

// GET /api/permisos/:id_usuario — obtiene permisos de un usuario
export async function getPermisos(request, response) {
  const { id_usuario } = request.params;
  try {
    const [rows] = await databasePool.query(
      `SELECT id_usuario, ${PERMISOS_VALIDOS.join(', ')} FROM permisos WHERE id_usuario = ?`,
      [id_usuario]
    );
    if (rows.length === 0) {
      return response.status(404).json({ message: 'Permisos no encontrados para este usuario.' });
    }
    return response.json(rows[0]);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// PUT /api/permisos/:id_usuario — actualiza permisos de un empleado
export async function updatePermisos(request, response) {
  const { id_usuario } = request.params;

  try {
    // Verificar que el usuario existe y no es admin
    const [userRows] = await databasePool.query(
      'SELECT role FROM users WHERE id = ?', [id_usuario]
    );

    if (userRows.length === 0) {
      return response.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (userRows[0].role === 'admin') {
      return response.status(400).json({ message: 'No se pueden modificar permisos de un admin.' });
    }

    // Upsert: actualiza si existe, inserta si no
    await databasePool.query(`
      INSERT INTO permisos (id_usuario, ${PERMISOS_VALIDOS.join(', ')})
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ${PERMISOS_VALIDOS.map((p) => `${p} = VALUES(${p})`).join(',\n        ')}
    `, [id_usuario, ...normalizarPermisos(request.body)]);

    return response.json({ message: 'Permisos actualizados correctamente.' });
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}
