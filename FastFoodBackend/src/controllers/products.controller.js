/**
 * src/controllers/products.controller.js
 * CRUD de productos. Stack traces internos, nunca expuestos al cliente.
 *
 * Los :id llegan ya validados como enteros positivos (validateIdParams).
 * El body llega validado por validateBody(schemas.product).
 */
import { databasePool } from '../config/database.js';

const PRODUCT_COLUMNS = `
  p.id, p.name, p.description, p.price, p.category_id,
  p.image_url, p.is_available, p.stock_actual, p.stock_minimo,
  p.unidades_paq, p.created_at, c.name AS category_name
`;

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function productParams(body) {
  const { name, description, price, category_id, image_url, is_available, stock_minimo, unidades_paq } = body;
  return [
    String(name).trim(),
    description ? String(description).trim() : null,
    Number(price),
    category_id ? Number(category_id) : null,
    image_url ? String(image_url).trim() : null,
    toBoolean(is_available),
    stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? Number(stock_minimo) : 5,
    unidades_paq ? Number(unidades_paq) : null
  ];
}

// GET /api/products
export async function getProducts(_request, response) {
  try {
    const [rows] = await databasePool.query(`
      SELECT ${PRODUCT_COLUMNS}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// GET /api/products/:id
export async function getProductById(request, response) {
  const { id } = request.params;
  try {
    const [rows] = await databasePool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return response.status(404).json({ message: 'Producto no encontrado.' });
    }
    return response.json(rows[0]);
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// POST /api/products (solo admin)
export async function createProduct(request, response) {
  try {
    const [result] = await databasePool.query(
      `INSERT INTO products
         (name, description, price, category_id, image_url, is_available, stock_minimo, unidades_paq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      productParams(request.body)
    );
    const [rows] = await databasePool.query(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );
    return response.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return response.status(400).json({ message: 'La categoría indicada no existe.' });
    }
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// PUT /api/products/:id (solo admin)
export async function updateProduct(request, response) {
  const { id } = request.params;

  try {
    const [result] = await databasePool.query(
      `UPDATE products
         SET name = ?, description = ?, price = ?, category_id = ?, image_url = ?,
             is_available = ?, stock_minimo = ?, unidades_paq = ?
       WHERE id = ?`,
      [...productParams(request.body), id]
    );
    if (result.affectedRows === 0) {
      return response.status(404).json({ message: 'Producto no encontrado.' });
    }
    const [rows] = await databasePool.query('SELECT * FROM products WHERE id = ?', [id]);
    return response.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return response.status(400).json({ message: 'La categoría indicada no existe.' });
    }
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}

// DELETE /api/products/:id (solo admin)
export async function deleteProduct(request, response) {
  const { id } = request.params;
  try {
    const [result] = await databasePool.query(
      'DELETE FROM products WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return response.status(404).json({ message: 'Producto no encontrado.' });
    }
    return response.json({ message: 'Producto eliminado correctamente.' });
  } catch {
    return response.status(500).json({ message: 'Error interno del servidor.' });
  }
}
