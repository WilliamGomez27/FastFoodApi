/**
 * src/tests/setup.js
 * Configuración global previa a la ejecución de pruebas
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-secret-key-super-secure-32-chars-min-length!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_ORIGINS = 'http://localhost:5500,http://127.0.0.1:5500';
process.env.DB_NAME = 'supermarket_db';
process.env.AUTH_DISABLED = 'false';
process.env.BCRYPT_ROUNDS = '4'; // Acelera las pruebas unitarias que usan hashing
