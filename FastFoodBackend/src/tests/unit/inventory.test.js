import { test } from 'node:test';
import assert from 'node:assert';
import { calcularMovimiento } from '../../controllers/inventory.controller.js';
import { normalizarPermisos } from '../../controllers/users.controller.js';

test('Unit: Lógica de inventario y usuarios', async (t) => {
  await t.test('calcularMovimiento calcula entradas correctamente', () => {
    const res = calcularMovimiento(10, 25);
    assert.strictEqual(res.tipo, 'entrada');
    assert.strictEqual(res.cantidad, 15);
    assert.strictEqual(res.diferencia, 15);
  });

  await t.test('calcularMovimiento calcula salidas correctamente', () => {
    const res = calcularMovimiento(30, 10);
    assert.strictEqual(res.tipo, 'salida');
    assert.strictEqual(res.cantidad, 20);
    assert.strictEqual(res.diferencia, -20);
  });

  await t.test('calcularMovimiento maneja stock idéntico como entrada de 0', () => {
    const res = calcularMovimiento(15, 15);
    assert.strictEqual(res.tipo, 'entrada');
    assert.strictEqual(res.cantidad, 0);
  });

  await t.test('normalizarPermisos convierte objeto booleano/numérico a array posicional', () => {
    const permisos = { puede_inventario: true, puede_ventas: 1, puede_compras: '0' };
    const arr = normalizarPermisos(permisos);
    assert.strictEqual(arr.length, 5);
    // [puede_ventas, puede_inventario, puede_compras, puede_clientes, puede_reportes]
    assert.strictEqual(arr[0], 1); // puede_ventas
    assert.strictEqual(arr[1], 1); // puede_inventario
    assert.strictEqual(arr[2], 0); // puede_compras
    assert.strictEqual(arr[3], 0); // puede_clientes
    assert.strictEqual(arr[4], 0); // puede_reportes
  });
});
