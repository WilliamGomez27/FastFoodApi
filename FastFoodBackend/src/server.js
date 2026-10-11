/**
 * src/server.js
 * Punto de entrada: arranca el servidor HTTP.
 * La configuración de Express vive en app.js (testeable sin abrir puertos).
 */
import { app } from './app.js';
import { env } from './config/env.js';
import { databasePool } from './config/database.js';

if (env.authDisabled) {
  console.warn('');
  console.warn('⚠️  ════════════════════════════════════════════════════════════');
  console.warn('⚠️  AUTENTICACIÓN DESACTIVADA (AUTH_DISABLED=true)');
  console.warn('⚠️  Todas las peticiones se tratan como usuario admin "Dev".');
  console.warn('⚠️  Solo para desarrollo. Pon AUTH_DISABLED=false para reactivarla.');
  console.warn('⚠️  ════════════════════════════════════════════════════════════');
  console.warn('');
}

const server = app.listen(env.port, () => {
  console.log(`✅ FastFood API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});

// Cierre ordenado (docker stop / Ctrl+C)
function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(async () => {
    await databasePool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));