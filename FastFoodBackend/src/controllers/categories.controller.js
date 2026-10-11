/**
 * src/controllers/categories.controller.js
 * CRUD de categorías. Nunca expone error.message al cliente.
 */
import { databasePool } from '../config/database.js';

// GET /api/categories - Obtener todas las categorías
export async function getCategories(_request, response) {
  try {
    const [rows] = await databasePool.query(
      'SELECT id, name, description, created_at FROM categories ORDER BY created_at DESC'
    );
    return response.json(rows);
  } catch {
    return response.status(500).json({ message: 'Error al obtener categorías.' });
  }
}

// POST /api/categories - Crear nueva categoría (body validado por schemas.category)
export async function createCategory(request, response) {
  const { name, description } = request.body;
  try {
    const [result] = await databasePool.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [String(name).trim(), description ? String(description).trim() : null]
    );
    const [rows] = await databasePool.query(
      'SELECT id, name, description, created_at FROM categories WHERE id = ?',
      [result.insertId]
    );
    return response.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ message: 'Ya existe una categoría con ese nombre.' });
    }
    return response.status(500).json({ message: 'Error al crear categoría.' });
  }
}

// DELETE /api/categories/:id - Eliminar categoría
export async function deleteCategory(request, response) {
  const { id } = request.params;
  try {
    const [result] = await databasePool.query('DELETE FROM categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return response.status(404).json({ message: 'Categoría no encontrada.' });
    }
    return response.json({ message: 'Categoría eliminada correctamente.' });
  } catch {
    return response.status(500).json({ message: 'Error al eliminar categoría.' });
  }
}
