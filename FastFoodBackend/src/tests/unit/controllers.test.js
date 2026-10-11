import { test } from 'node:test';
import assert from 'node:assert';
import { databasePool } from '../../config/database.js';
import { getUsers, getUserById, deleteUser } from '../../controllers/users.controller.js';
import { getCategories, createCategory, deleteCategory } from '../../controllers/categories.controller.js';
import { getProducts, getProductById, deleteProduct } from '../../controllers/products.controller.js';
import { getInventario, getAlertas, getHistorial } from '../../controllers/inventory.controller.js';
import { getPermisos } from '../../controllers/permissions.controller.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return res;
}

test('Unit: Controladores con simulación de BD', async (t) => {
  const originalQuery = databasePool.query;

  t.afterEach(() => {
    databasePool.query = originalQuery;
  });

  await t.test('getUsers devuelve lista de usuarios', async () => {
    databasePool.query = async () => [[{ id: 1, name: 'Admin', role: 'admin' }]];
    const res = createMockRes();
    await getUsers({}, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.length, 1);
  });

  await t.test('getUserById devuelve 404 si no existe', async () => {
    databasePool.query = async () => [[]];
    const res = createMockRes();
    await getUserById({ params: { id: 99 } }, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t.test('deleteUser rechaza si intenta eliminarse a sí mismo', async () => {
    const res = createMockRes();
    await deleteUser({ params: { id: 1 }, user: { sub: 1 } }, res);
    assert.strictEqual(res.statusCode, 400);
    assert(res.body.message.includes('ti mismo'));
  });

  await t.test('getCategories devuelve categorías', async () => {
    databasePool.query = async () => [[{ id: 1, name: 'Bebidas' }]];
    const res = createMockRes();
    await getCategories({}, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body[0].name, 'Bebidas');
  });

  await t.test('createCategory crea categoría', async () => {
    databasePool.query = async (sql) => {
      if (sql.includes('INSERT INTO categories')) return [{ insertId: 2 }];
      return [[{ id: 2, name: 'Postres' }]];
    };
    const res = createMockRes();
    await createCategory({ body: { name: 'Postres' } }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.id, 2);
  });

  await t.test('deleteCategory devuelve 404 si no encuentra fila', async () => {
    databasePool.query = async () => [{ affectedRows: 0 }];
    const res = createMockRes();
    await deleteCategory({ params: { id: 999 } }, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t.test('getProducts devuelve productos con stock', async () => {
    databasePool.query = async () => [[{ id: 1, name: 'Combo 1', price: 15000, stock_actual: 10 }]];
    const res = createMockRes();
    await getProducts({}, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body[0].name, 'Combo 1');
  });

  await t.test('getProductById devuelve producto', async () => {
    databasePool.query = async () => [[{ id: 1, name: 'Combo 1' }]];
    const res = createMockRes();
    await getProductById({ params: { id: 1 } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.name, 'Combo 1');
  });

  await t.test('deleteProduct devuelve 404 si no existe', async () => {
    databasePool.query = async () => [{ affectedRows: 0 }];
    const res = createMockRes();
    await deleteProduct({ params: { id: 50 } }, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t.test('getInventario devuelve stock clasificado', async () => {
    databasePool.query = async () => [[{ id_producto: 1, nombre: 'Papas', estado_stock: 'ok' }]];
    const res = createMockRes();
    await getInventario({}, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body[0].estado_stock, 'ok');
  });

  await t.test('getAlertas devuelve productos con stock bajo', async () => {
    databasePool.query = async () => [[{ id_producto: 2, nombre: 'Salsa', estado_stock: 'stock_bajo' }]];
    const res = createMockRes();
    await getAlertas({}, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body[0].nombre, 'Salsa');
  });

  await t.test('getHistorial devuelve movimientos', async () => {
    databasePool.query = async () => [[{ id_movimiento: 1, cantidad: 5, tipo: 'entrada' }]];
    const res = createMockRes();
    await getHistorial({ query: { limit: '50' } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.length, 1);
  });

  await t.test('getPermisos devuelve 404 si usuario no tiene registro', async () => {
    databasePool.query = async () => [[]];
    const res = createMockRes();
    await getPermisos({ params: { id_usuario: 88 } }, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t.test('login con credenciales inválidas devuelve 401', async () => {
    const { login } = await import('../../controllers/auth.controller.js');
    databasePool.query = async () => [[]]; // Usuario no existe
    const res = createMockRes();
    await login({ body: { email: 'inexistente@test.com', password: 'password123' } }, res);
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test('register crea usuario correctamente', async () => {
    const { register } = await import('../../controllers/auth.controller.js');
    databasePool.query = async () => [{ insertId: 5 }];
    const res = createMockRes();
    await register({ body: { name: 'Carlos', email: 'carlos@test.com', password: 'password123', role: 'employee' } }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.userId, 5);
  });

  await t.test('updateProduct devuelve 404 si no encuentra el producto', async () => {
    const { updateProduct } = await import('../../controllers/products.controller.js');
    databasePool.query = async () => [{ affectedRows: 0 }];
    const res = createMockRes();
    await updateProduct({ params: { id: 77 }, body: { name: 'Papas', price: 5000 } }, res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t.test('updatePermisos rechaza modificar un usuario admin (400)', async () => {
    const { updatePermisos } = await import('../../controllers/permissions.controller.js');
    databasePool.query = async () => [[{ role: 'admin' }]];
    const res = createMockRes();
    await updatePermisos({ params: { id_usuario: 1 }, body: { puede_ventas: true } }, res);
    assert.strictEqual(res.statusCode, 400);
    assert(res.body.message.includes('No se pueden modificar permisos de un admin'));
  });
});
