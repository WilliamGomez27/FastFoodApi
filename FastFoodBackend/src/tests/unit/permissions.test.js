import { test } from 'node:test';
import assert from 'node:assert';
import { requirePermiso, PERMISOS_VALIDOS } from '../../middleware/permissions.js';

test('Unit: Control granular de permisos (requirePermiso)', async (t) => {
  await t.test('Falla al crear el middleware si el permiso no está en la lista blanca', () => {
    assert.throws(() => {
      requirePermiso('permiso_inexistente_o_inyeccion');
    }, /Permiso desconocido/);
  });

  await t.test('Admin siempre tiene acceso sin consultar la base de datos', async () => {
    // Mock de pool que fallaría si se llama
    const mockPool = {
      query() { throw new Error('No debe consultar la BD para admin'); }
    };
    const req = { user: { sub: 1, role: 'admin' } };
    let nextCalled = false;

    const middleware = requirePermiso('puede_inventario', mockPool);
    await middleware(req, {}, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  await t.test('Empleado con permiso concedido pasa correctamente', async () => {
    const mockPool = {
      async query(sql, params) {
        assert(sql.includes('FROM permisos'));
        assert.deepStrictEqual(params, ['puede_inventario', 2]);
        return [[{ permitido: 1 }]];
      }
    };
    const req = { user: { sub: 2, role: 'employee' } };
    let nextCalled = false;

    const middleware = requirePermiso('puede_inventario', mockPool);
    await middleware(req, {}, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  await t.test('Empleado sin permiso es rechazado con 403', async () => {
    const mockPool = {
      async query() {
        return [[{ permitido: 0 }]];
      }
    };
    const req = { user: { sub: 3, role: 'employee' } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(data) { jsonSent = data; return this; }
    };
    let nextCalled = false;

    const middleware = requirePermiso('puede_inventario', mockPool);
    await middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusSent, 403);
    assert(jsonSent.message.includes('No tienes permiso'));
  });

  await t.test('Exporta la lista estricta de permisos válidos', () => {
    assert(Array.isArray(PERMISOS_VALIDOS));
    assert(PERMISOS_VALIDOS.includes('puede_inventario'));
    assert(PERMISOS_VALIDOS.includes('puede_ventas'));
  });
});
