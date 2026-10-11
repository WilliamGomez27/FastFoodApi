import { test } from 'node:test';
import assert from 'node:assert';
import { parseFrontendOrigins } from '../../config/env.js';

test('Unit: Configuración de entorno y CORS (parseFrontendOrigins)', async (t) => {
  await t.test('Retorna orígenes locales por defecto en development', () => {
    const origins = parseFrontendOrigins(undefined, 'development');
    assert(Array.isArray(origins));
    assert(origins.includes('http://localhost:5500'));
  });

  await t.test('Exige FRONTEND_ORIGINS en production si no está definido', () => {
    assert.throws(() => {
      parseFrontendOrigins(undefined, 'production');
    }, /FRONTEND_ORIGINS es obligatoria/);
  });

  await t.test('Exige HTTPS en production para orígenes remotos', () => {
    assert.throws(() => {
      parseFrontendOrigins('http://inseguro.com', 'production');
    }, /HTTPS/);
  });

  await t.test('Acepta HTTPS válido en production', () => {
    const origins = parseFrontendOrigins('https://admin.fastfood.com, https://app.fastfood.com', 'production');
    assert.deepStrictEqual(origins, ['https://admin.fastfood.com', 'https://app.fastfood.com']);
  });

  await t.test('Rechaza orígenes con rutas añadidas (como /api)', () => {
    assert.throws(() => {
      parseFrontendOrigins('https://admin.fastfood.com/api', 'development');
    }, /no debe incluir rutas/);
  });
});
