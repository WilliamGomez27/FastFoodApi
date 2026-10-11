/**
 * src/controllers/auth.controller.js
 * Autenticación real con bcrypt y validación de entrada.
 *
 * SEGURIDAD:
 * - bcrypt con coste 12 para hashing de contraseñas (resistente a GPU cracking)
 * - Mensajes de error genéricos en login (no revela si el email existe)
 * - Stack traces nunca se exponen al cliente
 */
import { databasePool } from '../config/database.js';
import { createToken } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from './users.controller.js';

// Hash ficticio: se compara cuando el email no existe para igualar el tiempo
// de respuesta y no revelar qué emails están registrados (user enumeration).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', BCRYPT_ROUNDS);

// POST /api/auth/login
export async function login(request, response) {
  const { email, password } = request.body;
  // Nota: validateBody(schemas.login) en server.js ya validó el formato

  try {
    const [rows] = await databasePool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    // Mensaje genérico intencionalmente: no revelar si el email existe
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !passwordMatch) {
      return response.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = createToken({
      sub:   user.id,
      email: user.email,
      role:  user.role,
      name:  user.name
    });

    return response.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch {
    // No exponer error.message al cliente
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// POST /api/auth/register (solo admin, protegido en server.js)
export async function register(request, response) {
  const { name, email, password, role } = request.body;
  // Nota: validateBody(schemas.register) en server.js ya validó el formato

  // Sanitizar: un admin no puede crear otro super-admin si no existe ese rol
  const allowedRoles = ['admin', 'employee'];
  const assignedRole = allowedRoles.includes(role) ? role : 'employee';

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [result] = await databasePool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole]
    );

    return response.status(201).json({
      message: 'Usuario creado correctamente.',
      userId: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ message: 'El email ya está registrado.' });
    }
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}
