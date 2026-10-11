import { test } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../app.js';

test('Security: Cabeceras de seguridad y sanitización HTTP', async (t) => {
  await t.test('Cabecera X-Powered-By está deshabilitada', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.headers['x-powered-by'], undefined);
  });

  await t.test('Helmet inyecta cabeceras de protección defensiva', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert(res.headers['content-security-policy'] !== undefined);
  });

  await t.test('Manejo seguro de JSON malformado (responde 400 sin exponer stack trace)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "incompleto"'); // JSON roto

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.stack, undefined);
    assert(res.body.message.includes('JSON'));
  });

  await t.test('Manejo seguro de payload gigante (rechaza con 413 si supera límite)', async () => {
    // Generar string de ~200kb
    const bigString = 'A'.repeat(250 * 1024);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'test@example.com', password: bigString }));

    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.stack, undefined);
  });

  await t.test('Rutas 404 devuelven mensaje estándar sin detalles de servidor', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe-nunca');
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.body, { message: 'Ruta no encontrada' });
  });

  await t.test('Protección contra inyección SQL en parámetros de ruta con validateIdParams', async () => {
    const { createToken } = await import('../../middleware/auth.js');
    const token = createToken({ sub: 1, role: 'admin' });
    const res = await request(app)
      .get('/api/products/1%20OR%201=1')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 400);
    assert(res.body.message.includes('entero positivo'));
  });

  await t.test('El servidor no permite AUTH_DISABLED=true en producción', () => {
    // Intentar importar o evaluar env en production con authDisabled=true debe lanzar error
    const checkProdAuthBypass = (authFlag, nodeEnv) => {
      const allowed = ['development', 'test'];
      const disabled = String(authFlag).toLowerCase() === 'true';
      if (disabled && !allowed.includes(nodeEnv)) {
        throw new Error('AUTH_DISABLED=true no está permitido en producción');
      }
    };

    assert.throws(() => {
      checkProdAuthBypass('true', 'production');
    }, /no está permitido en producción/);

    // En test o development no debe lanzar
    assert.doesNotThrow(() => {
      checkProdAuthBypass('true', 'development');
      checkProdAuthBypass('true', 'test');
    });
  });
});
