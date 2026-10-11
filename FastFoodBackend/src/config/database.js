import mysql from 'mysql2/promise';
import { env } from './env.js';

export const databasePool = mysql.createPool({
  host: env.database.host,
  port: env.database.port,
  database: env.database.name,
  user: env.database.user,
  password: env.database.password,
  waitForConnections: true,
  connectionLimit: env.database.connectionLimit,
  queueLimit: 0
});

export async function checkDatabaseConnection() {
  const connection = await databasePool.getConnection();

  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}