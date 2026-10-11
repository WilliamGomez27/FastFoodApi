import { test } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../app.js';
import { createToken } from '../../middleware/auth.js';

test('API: Endpoints básicos y protección de rutas', async (t) => {
  await t.test('GET /api/health responde 200 o 503 con estructura segura', async () => {
    const res = await request(app).get('/api/health');
    assert([200, 503].includes(res.status));
    assert(res.body.status !== undefined);
    assert(res.body.database !== undefined);
    // Verificar que nunca filtre credenciales o stack trace
    assert.strictEqual(res.body.password, undefined);
    assert.strictEqual(res.body.stack, undefined);
  });

  await t.test('GET /api/protected rechaza sin token (401)', async () => {
    const res = await request(app).get('/api/protected');
    assert.strictEqual(res.status, 401);
    assert(res.body.message.includes('requerido'));
  });

  await t.test('GET /api/protected autoriza con token válido', async () => {
    const token = createToken({ sub: 1, role: 'admin', name: 'Administrador' });
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Acceso autorizado');
    assert.strictEqual(res.body.user.role, 'admin');
  });

  await t.test('POST /api/auth/login valida campos obligatorios (400)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    assert.strictEqual(res.status, 400);
    assert(res.body.errors && res.body.errors.length > 0);
  });

  await t.test('GET /api/products/:id valida que id sea entero positivo (400)', async () => {
    const token = createToken({ sub: 1, role: 'admin' });
    const res = await request(app)
      .get('/api/products/abc')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 400);
    assert(res.body.message.includes('entero positivo'));
  });
});
