/**
 * src/routes/index.js
 * Definición de todas las rutas de la API, agrupadas por dominio.
 */
import { Router } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseConnection } from '../config/database.js';
import { createToken, requireAuth, requireRole } from '../middleware/auth.js';
import { requirePermiso } from '../middleware/permissions.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateIdParams, schemas } from '../middleware/validate.js';

import { login, register } from '../controllers/auth.controller.js';
import { getCategories, createCategory, deleteCategory } from '../controllers/categories.controller.js';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/products.controller.js';
import { getUsers, getUserById, createUser, deleteUser } from '../controllers/users.controller.js';
import { getPermisos, updatePermisos } from '../controllers/permissions.controller.js';
import { getInventario, getAlertas, getHistorial, ajustarStock } from '../controllers/inventory.controller.js';

const adminOnly = [requireAuth, requireRole('admin')];
const id = validateIdParams('id');

export function buildRouter() {
  const router = Router();

  // ─── PÚBLICAS ───────────────────────────────────────────────────────────────
  router.get('/health', async (_request, response) => {
    try {
      await checkDatabaseConnection();
      return response.json({ status: 'ok', database: 'connected', authDisabled: env.authDisabled });
    } catch {
      // No exponer detalles de la BD (host, usuario, etc.)
      return response.status(503).json({ status: 'degraded', database: 'unavailable', authDisabled: env.authDisabled });
    }
  });

  router.post('/auth/login', loginLimiter, validateBody(schemas.login), login);
  router.post('/auth/register', ...adminOnly, validateBody(schemas.register), register);

  // Dev Token (solo disponible en desarrollo)
  if (env.nodeEnv === 'development') {
    router.post('/auth/dev-token', (_request, response) => {
      const token = createToken({ sub: 0, name: 'Dev', role: 'admin' });
      return response.json({ token });
    });
  }

  // ─── USUARIOS (solo admin) ──────────────────────────────────────────────────
  router.get('/users', ...adminOnly, getUsers);
  router.get('/users/:id', ...adminOnly, id, getUserById);
  router.post('/users', ...adminOnly, validateBody(schemas.createUser), createUser);
  router.delete('/users/:id', ...adminOnly, id, deleteUser);

  // ─── PERMISOS (solo admin) ──────────────────────────────────────────────────
  const idUsuario = validateIdParams('id_usuario');
  router.get('/permisos/:id_usuario', ...adminOnly, idUsuario, getPermisos);
  router.put('/permisos/:id_usuario', ...adminOnly, idUsuario, validateBody(schemas.permisos), updatePermisos);

  // ─── PROTEGIDAS ─────────────────────────────────────────────────────────────
  router.get('/protected', requireAuth, (request, response) => {
    return response.json({ message: 'Acceso autorizado', user: request.user });
  });

  // Categorías
  router.get('/categories', requireAuth, getCategories);
  router.post('/categories', ...adminOnly, validateBody(schemas.category), createCategory);
  router.delete('/categories/:id', ...adminOnly, id, deleteCategory);

  // Productos
  router.get('/products', requireAuth, getProducts);
  router.get('/products/:id', requireAuth, id, getProductById);
  router.post('/products', ...adminOnly, validateBody(schemas.product), createProduct);
  router.put('/products/:id', ...adminOnly, id, validateBody(schemas.product), updateProduct);
  router.delete('/products/:id', ...adminOnly, id, deleteProduct);

  // Inventario
  const inventario = [requireAuth, requirePermiso('puede_inventario')];
  router.get('/inventario', ...inventario, getInventario);
  router.get('/inventario/alertas', ...inventario, getAlertas);
  router.get('/inventario/historial', ...inventario, getHistorial);
  router.put(
    '/inventario/:id_producto',
    ...adminOnly,
    validateIdParams('id_producto'),
    validateBody(schemas.stockAdjust),
    ajustarStock
  );

  return router;
}
