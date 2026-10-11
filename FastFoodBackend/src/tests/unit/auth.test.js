import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { createToken, requireAuth, requireRole, DEV_USER } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

test('Unit: Autenticación JWT y RBAC', async (t) => {
  await t.test('createToken genera token firmado verificable', () => {
    const token = createToken({ sub: 10, role: 'admin', name: 'Tester' });
    const payload = jwt.verify(token, env.jwtSecret);
    assert.strictEqual(payload.sub, 10);
    assert.strictEqual(payload.role, 'admin');
    assert.strictEqual(payload.name, 'Tester');
  });

  await t.test('requireAuth rechaza petición sin header de autorización con 401', () => {
    const req = { headers: {} };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(data) { jsonSent = data; return this; }
    };
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusSent, 401);
    assert(jsonSent.message.includes('requerido'));
  });

  await t.test('requireAuth permite acceso con token Bearer válido', () => {
    const token = createToken({ sub: 5, role: 'employee', name: 'Juan' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextCalled = false;

    requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.sub, 5);
    assert.strictEqual(req.user.role, 'employee');
  });

  await t.test('requireAuth rechaza token manipulado o expirado con 401', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.signature' } };
    let statusSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json() { return this; }
    };

    requireAuth(req, res, () => {});
    assert.strictEqual(statusSent, 401);
  });

  await t.test('requireRole permite acceso a roles autorizados', () => {
    const req = { user: { role: 'admin' } };
    const res = {};
    let nextCalled = false;

    const check = requireRole('admin', 'manager');
    check(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  await t.test('requireRole deniega acceso con 403 a roles no autorizados', () => {
    const req = { user: { role: 'employee' } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(data) { jsonSent = data; return this; }
    };
    let nextCalled = false;

    const check = requireRole('admin');
    check(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusSent, 403);
    assert(jsonSent.message.includes('Acceso denegado'));
  });

  await t.test('requireAuth respeta authDisabled cuando está activo (bypass de dev)', () => {
    const original = env.authDisabled;
    try {
      env.authDisabled = true;
      const req = { headers: {} };
      let nextCalled = false;

      requireAuth(req, {}, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.role, DEV_USER.role);
      assert.strictEqual(req.user.name, DEV_USER.name);
    } finally {
      env.authDisabled = original;
    }
  });
});
