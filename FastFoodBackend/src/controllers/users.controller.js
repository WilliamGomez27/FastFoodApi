/**
 * src/controllers/users.controller.js
 * Gestión de usuarios — solo accesible por admin.
 *
 * SEGURIDAD:
 * - Nunca retorna el campo password
 * - Solo admin puede listar, crear, editar y eliminar usuarios
 * - Al crear empleado, se crea automáticamente su registro en permisos
 *   (en la misma transacción: o se crean ambos o ninguno)
 * - No se puede eliminar al último administrador
 */
import bcrypt from 'bcrypt';
import { databasePool } from '../config/database.js';
import { PERMISOS_VALIDOS } from '../middleware/permissions.js';

export const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const USER_SELECT = `
  SELECT
    u.id, u.name, u.email, u.role, u.created_at,
    p.puede_ventas, p.puede_inventario, p.puede_compras,
    p.puede_clientes, p.puede_reportes
  FROM users u
  LEFT JOIN permisos p ON u.id = p.id_usuario
`;

/** Convierte un objeto de permisos arbitrario en [0|1, ...] en el orden de PERMISOS_VALIDOS. */
export function normalizarPermisos(permisos = {}) {
  const source = permisos && typeof permisos === 'object' ? permisos : {};
  return PERMISOS_VALIDOS.map((key) => {
    const v = source[key];
    return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
  });
}

// GET /api/users — lista todos los usuarios con sus permisos
export async function getUsers(_request, response) {
  try {
    const [rows] = await databasePool.query(`${USER_SELECT} ORDER BY u.created_at DESC`);
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// GET /api/users/:id — obtiene un usuario con sus permisos
export async function getUserById(request, response) {
  const { id } = request.params;
  try {
    const [rows] = await databasePool.query(`${USER_SELECT} WHERE u.id = ?`, [id]);

    if (rows.length === 0) {
      return response.status(404).json({ message: 'Usuario no encontrado.' });
    }
    return response.json(rows[0]);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// POST /api/users — crea un usuario (body validado por schemas.createUser)
export async function createUser(request, response) {
  const { name, email, password, role = 'employee', permisos = {} } = request.body;
  const assignedRole = role === 'admin' ? 'admin' : 'employee';

  let connection;
  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    connection = await databasePool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [String(name).trim(), String(email).toLowerCase().trim(), hashedPassword, assignedRole]
    );
    const userId = result.insertId;

    // Si es empleado, crear registro de permisos (todos en 0 salvo los indicados)
    if (assignedRole === 'employee') {
      await connection.query(
        `INSERT INTO permisos (id_usuario, ${PERMISOS_VALIDOS.join(', ')})
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, ...normalizarPermisos(permisos)]
      );
    }

    await connection.commit();
    return response.status(201).json({ message: 'Usuario creado correctamente.', userId });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ message: 'El email ya está registrado.' });
    }
    return response.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    if (connection) connection.release();
  }
}

// DELETE /api/users/:id — elimina un usuario (CASCADE borra sus permisos)
export async function deleteUser(request, response) {
  const id = Number(request.params.id);

  // No permitir que admin se elimine a sí mismo (sub puede venir como string o number)
  if (id === Number(request.user?.sub)) {
    return response.status(400).json({ message: 'No puedes eliminarte a ti mismo.' });
  }

  try {
    const [target] = await databasePool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (target.length === 0) {
      return response.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (target[0].role === 'admin') {
      const [[{ total }]] = await databasePool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'"
      );
      if (Number(total) <= 1) {
        return response.status(400).json({ message: 'No se puede eliminar al último administrador.' });
      }
    }

    await databasePool.query('DELETE FROM users WHERE id = ?', [id]);
    return response.json({ message: 'Usuario eliminado correctamente.' });
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}