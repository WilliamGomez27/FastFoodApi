/**
 * src/controllers/inventory.controller.js
 * Gestión de inventario — productos con stock, alertas y historial de movimientos.
 *
 * Usa la tabla única `products` (antes se consultaba una tabla `productos`
 * que nunca se creaba). Las columnas se exponen con alias en español para
 * mantener compatibilidad con el frontend.
 *
 * ENDPOINTS:
 * GET  /api/inventario              — lista todos los productos con su stock
 * GET  /api/inventario/alertas      — solo productos con stock bajo o sin stock
 * GET  /api/inventario/historial    — historial de movimientos del inventario
 * PUT  /api/inventario/:id_producto — ajuste manual de stock (solo admin)
 */
import { databasePool } from '../config/database.js';

const HISTORIAL_MAX = 500;

// GET /api/inventario — lista completa de productos con stock
export async function getInventario(_request, response) {
  try {
    const [rows] = await databasePool.query(`
      SELECT
        p.id            AS id_producto,
        p.name          AS nombre,
        p.unidades_paq,
        p.price         AS precio_venta,
        p.stock_actual,
        p.stock_minimo,
        CASE
          WHEN p.stock_actual = 0               THEN 'sin_stock'
          WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
          ELSE                                       'ok'
        END AS estado_stock
      FROM products p
      ORDER BY
        CASE
          WHEN p.stock_actual = 0               THEN 0
          WHEN p.stock_actual <= p.stock_minimo THEN 1
          ELSE                                       2
        END,
        p.name ASC
    `);
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// GET /api/inventario/alertas — solo productos con stock bajo o sin stock
export async function getAlertas(_request, response) {
  try {
    const [rows] = await databasePool.query(`
      SELECT
        id   AS id_producto,
        name AS nombre,
        stock_actual,
        stock_minimo,
        CASE
          WHEN stock_actual = 0 THEN 'sin_stock'
          ELSE                       'stock_bajo'
        END AS estado_stock
      FROM products
      WHERE stock_actual <= stock_minimo
      ORDER BY stock_actual ASC
    `);
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// GET /api/inventario/historial?limit=100 — historial de movimientos
export async function getHistorial(request, response) {
  const requested = Number.parseInt(request.query?.limit, 10);
  const limit = Number.isInteger(requested) && requested > 0
    ? Math.min(requested, HISTORIAL_MAX)
    : 100;

  try {
    const [rows] = await databasePool.query(`
      SELECT
        h.id_movimiento,
        h.id_producto,
        p.name AS nombre_producto,
        h.cantidad,
        h.tipo,
        h.motivo,
        h.id_usuario,
        h.fecha
      FROM historial_inventario h
      LEFT JOIN products p ON h.id_producto = p.id
      ORDER BY h.fecha DESC, h.id_movimiento DESC
      LIMIT ?
    `, [limit]);
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

/**
 * Calcula el movimiento resultante de un ajuste de stock.
 * Función pura → fácil de testear unitariamente.
 */
export function calcularMovimiento(stockAnterior, stockNuevo) {
  const diferencia = stockNuevo - stockAnterior;
  return {
    diferencia,
    cantidad: Math.abs(diferencia),
    tipo: diferencia >= 0 ? 'entrada' : 'salida'
  };
}

// PUT /api/inventario/:id_producto — ajuste manual de stock (solo admin)
// Body validado por schemas.stockAdjust; :id_producto por validateIdParams.
export async function ajustarStock(request, response) {
  const { id_producto } = request.params;
  const stockNuevo = Number(request.body.stock_actual);
  const motivo = request.body.motivo ? String(request.body.motivo).trim() : 'Ajuste manual';
  // sub = 0 corresponde al usuario dev (AUTH_DISABLED); no existe en BD
  const idUsuario = Number(request.user?.sub) > 0 ? Number(request.user.sub) : null;

  let connection;
  try {
    connection = await databasePool.getConnection();
    await connection.beginTransaction();

    // FOR UPDATE: bloquea la fila para evitar condiciones de carrera
    const [rows] = await connection.query(
      'SELECT stock_actual FROM products WHERE id = ? FOR UPDATE',
      [id_producto]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return response.status(404).json({ message: 'Producto no encontrado.' });
    }

    const stockAnterior = rows[0].stock_actual;
    const { cantidad, tipo } = calcularMovimiento(stockAnterior, stockNuevo);

    await connection.query(
      'UPDATE products SET stock_actual = ? WHERE id = ?',
      [stockNuevo, id_producto]
    );

    await connection.query(`
      INSERT INTO historial_inventario (id_producto, cantidad, tipo, motivo, id_usuario)
      VALUES (?, ?, ?, ?, ?)
    `, [id_producto, cantidad, tipo, motivo, idUsuario]);

    await connection.commit();
    return response.json({
      message: 'Stock actualizado correctamente.',
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo
    });
  } catch {
    if (connection) await connection.rollback().catch(() => {});
    return response.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    if (connection) connection.release();
  }
}
