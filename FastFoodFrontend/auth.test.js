import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, val) { this.store.set(key, String(val)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

const authScript = fs.readFileSync(new URL('./auth.js', import.meta.url), 'utf8');

function createEnv() {
  const context = {
    Date,
    Number,
    JSON,
    sessionStorage: new MockStorage(),
    window: {}
  };
  context.window.sessionStorage = context.sessionStorage;
  vm.createContext(context);
  vm.runInContext(authScript, context);
  return context;
}

test('Frontend: FastFoodAuth session helper', async (t) => {
  let env;
  beforeEach(() => {
    env = createEnv();
  });

  await t.test('guarda una sesión válida con token y usuario', () => {
    const user = { id: 1, name: 'Ana Gómez', email: 'ana@test.com' };
    const result = env.window.FastFoodAuth.saveSession('token-123', user, 60);

    assert.strictEqual(result, true);
    assert.strictEqual(env.window.FastFoodAuth.getToken(), 'token-123');
    assert.deepStrictEqual(env.window.FastFoodAuth.getUser(), user);
    assert.strictEqual(env.window.FastFoodAuth.isSessionValid(), true);
  });

  await t.test('devuelve false cuando el token está vacío', () => {
    const result = env.window.FastFoodAuth.saveSession('', { name: 'Ana' }, 60);
    assert.strictEqual(result, false);
  });

  await t.test('devuelve null cuando no hay token guardado', () => {
    assert.strictEqual(env.window.FastFoodAuth.getToken(), null);
    assert.strictEqual(env.window.FastFoodAuth.getUser(), null);
  });

  await t.test('detecta una sesión expirada', () => {
    env.sessionStorage.setItem('ff_token', 'token-123');
    env.sessionStorage.setItem('ff_token_expires_at', String(Date.now() - 1000));
    assert.strictEqual(env.window.FastFoodAuth.isSessionValid(), false);
  });

  await t.test('detecta una sesión válida cuando aún no expira', () => {
    const future = Date.now() + 60 * 60 * 1000;
    env.sessionStorage.setItem('ff_token', 'token-123');
    env.sessionStorage.setItem('ff_token_expires_at', String(future));
    assert.strictEqual(env.window.FastFoodAuth.isSessionValid(), true);
  });

  await t.test('limpia la sesión correctamente', () => {
    env.sessionStorage.setItem('ff_token', 'token-123');
    env.sessionStorage.setItem('ff_user', JSON.stringify({ name: 'Ana' }));
    env.sessionStorage.setItem('ff_token_expires_at', String(Date.now() + 60000));

    env.window.FastFoodAuth.clearSession();

    assert.strictEqual(env.window.FastFoodAuth.getToken(), null);
    assert.strictEqual(env.window.FastFoodAuth.getUser(), null);
    assert.strictEqual(env.window.FastFoodAuth.isSessionValid(), false);
  });

  await t.test('no rompe si el JSON del usuario está corrupto', () => {
    env.sessionStorage.setItem('ff_user', '{bad json');
    assert.strictEqual(env.window.FastFoodAuth.getUser(), null);
  });
});