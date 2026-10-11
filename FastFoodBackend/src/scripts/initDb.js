/**
 * src/scripts/initDb.js
 * Crea (de forma idempotente) TODAS las tablas que usa la API y migra
 * columnas faltantes en bases existentes. Seguro de ejecutar varias veces.
 *
 * Uso:
 *   npm run init-db            → crea/migra tablas
 *   npm run init-db -- --seed  → además inserta datos de ejemplo (si están vacías)
 */
import { fileURLToPath } from 'node:url';
import { databasePool } from '../config/database.js';

export const TABLES = [
  {
    name: 'categories',
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_categories_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'products',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category_id INT,
        image_url VARCHAR(255),
        is_available BOOLEAN DEFAULT true,
        stock_actual INT UNSIGNED NOT NULL DEFAULT 0,
        stock_minimo INT UNSIGNED NOT NULL DEFAULT 5,
        unidades_paq INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'employee') DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'permisos',
    sql: `
      CREATE TABLE IF NOT EXISTS permisos (
        id_usuario INT PRIMARY KEY,
        puede_ventas     TINYINT(1) NOT NULL DEFAULT 0,
        puede_inventario TINYINT(1) NOT NULL DEFAULT 0,
        puede_compras    TINYINT(1) NOT NULL DEFAULT 0,
        puede_clientes   TINYINT(1) NOT NULL DEFAULT 0,
        puede_reportes   TINYINT(1) NOT NULL DEFAULT 0,
        FOREIGN KEY (id_usuario) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  },
  {
    name: 'historial_inventario',
    sql: `
      CREATE TABLE IF NOT EXISTS historial_inventario (
        id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
        id_producto INT NULL,
        cantidad INT UNSIGNED NOT NULL,
        tipo ENUM('entrada', 'salida') NOT NULL,
        motivo VARCHAR(255) NOT NULL DEFAULT 'Ajuste manual',
        id_usuario INT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_historial_fecha (fecha),
        FOREIGN KEY (id_producto) REFERENCES products(id) ON DELETE SET NULL,
        FOREIGN KEY (id_usuario) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  }
];

/** Columnas añadidas después de la primera versión (migración para BDs existentes). */
export const COLUMN_MIGRATIONS = [
  { table: 'products', column: 'stock_actual', ddl: 'INT UNSIGNED NOT NULL DEFAULT 0' },
  { table: 'products', column: 'stock_minimo', ddl: 'INT UNSIGNED NOT NULL DEFAULT 5' },
  { table: 'products', column: 'unidades_paq', ddl: 'INT UNSIGNED NULL' }
];

async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

export async function initDatabase(pool = databasePool, { seed = false, log = console.log } = {}) {
  for (const table of TABLES) {
    await pool.query(table.sql);
    log(`✅ Tabla "${table.name}" lista.`);
  }

  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    if (!(await columnExists(pool, table, column))) {
      // table/column/ddl vienen de la constante de arriba, nunca de input externo
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
      log(`🔧 Columna "${table}.${column}" añadida.`);
    }
  }

  if (seed) {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM categories');
    if (Number(total) === 0) {
      await pool.query(
        "INSERT INTO categories (name, description) VALUES ('Hamburguesas', 'Clásicas y especiales'), ('Bebidas', 'Frías y calientes')"
      );
      await pool.query(`
        INSERT INTO products (name, description, price, category_id, stock_actual, stock_minimo)
        VALUES
          ('Hamburguesa clásica', 'Carne 150g, queso, lechuga', 18000,
            (SELECT id FROM categories WHERE name = 'Hamburguesas'), 25, 5),
          ('Gaseosa 400ml', 'Sabores surtidos', 4500,
            (SELECT id FROM categories WHERE name = 'Bebidas'), 3, 10),
          ('Limonada natural', 'Recién preparada', 6000,
            (SELECT id FROM categories WHERE name = 'Bebidas'), 0, 5)
      `);
      log('🌱 Datos de ejemplo insertados.');
    }
  }
}

// Ejecutar solo si se llama directamente (no al importarlo desde tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Iniciando configuración de la base de datos...');
  try {
    await initDatabase(databasePool, { seed: process.argv.includes('--seed') });
    console.log('🎉 ¡Base de datos inicializada correctamente!');
    process.exitCode = 0;
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error.message);
    process.exitCode = 1;
  } finally {
    await databasePool.end();
  }
}
