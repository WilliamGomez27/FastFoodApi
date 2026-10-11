import { test } from 'node:test';
import assert from 'node:assert';
import { validateSchema, schemas, validateIdParams } from '../../middleware/validate.js';

test('Unit: Validador de esquemas (validateSchema)', async (t) => {
  await t.test('Valida login correctamente', () => {
    const valid = validateSchema({ email: 'test@example.com', password: 'password123' }, schemas.login);
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.errors.length, 0);

    const invalidEmail = validateSchema({ email: 'notanemail', password: 'password123' }, schemas.login);
    assert.strictEqual(invalidEmail.valid, false);
    assert(invalidEmail.errors.some(e => e.includes('email')));

    const missingPass = validateSchema({ email: 'test@example.com' }, schemas.login);
    assert.strictEqual(missingPass.valid, false);
  });

  await t.test('Valida esquema de creación de usuario', () => {
    const validUser = validateSchema({
      name: 'Empleado Uno',
      email: 'empleado@test.com',
      password: 'password123',
      role: 'employee',
      permisos: { puede_inventario: true }
    }, schemas.createUser);
    assert.strictEqual(validUser.valid, true);

    const invalidRole = validateSchema({
      name: 'Empleado Uno',
      email: 'empleado@test.com',
      password: 'password123',
      role: 'superadmin'
    }, schemas.createUser);
    assert.strictEqual(invalidRole.valid, false);
  });

  await t.test('Valida esquema de productos', () => {
    const validProd = validateSchema({
      name: 'Hamburguesa Doble',
      price: 25000,
      stock_minimo: 10,
      unidades_paq: 2
    }, schemas.product);
    assert.strictEqual(validProd.valid, true);

    const invalidPrice = validateSchema({
      name: 'Hamburguesa',
      price: -5
    }, schemas.product);
    assert.strictEqual(invalidPrice.valid, false);

    const nonIntegerStock = validateSchema({
      name: 'Hamburguesa',
      price: 15000,
      stock_minimo: 3.5
    }, schemas.product);
    assert.strictEqual(nonIntegerStock.valid, false);
  });

  await t.test('Valida esquema de ajuste de stock', () => {
    const validAdjust = validateSchema({ stock_actual: 40, motivo: 'Recepción proveedor' }, schemas.stockAdjust);
    assert.strictEqual(validAdjust.valid, true);

    const invalidStock = validateSchema({ stock_actual: -2 }, schemas.stockAdjust);
    assert.strictEqual(invalidStock.valid, false);
  });
});

test('Unit: Middleware validateIdParams', async (t) => {
  await t.test('Acepta entero positivo y lo castea a número', () => {
    const req = { params: { id: '42' } };
    const res = {};
    let nextCalled = false;
    const middleware = validateIdParams('id');

    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.params.id, 42);
  });

  await t.test('Rechaza strings no numéricos o inyecciones con 400', () => {
    const req = { params: { id: '1 OR 1=1' } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(data) { jsonSent = data; return this; }
    };
    let nextCalled = false;
    const middleware = validateIdParams('id');

    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusSent, 400);
    assert(jsonSent.message.includes('entero positivo'));
  });

  await t.test('Rechaza cero o números negativos', () => {
    const req = { params: { id: '0' } };
    let statusSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json() { return this; }
    };
    const middleware = validateIdParams('id');
    middleware(req, res, () => {});
    assert.strictEqual(statusSent, 400);
  });
});
