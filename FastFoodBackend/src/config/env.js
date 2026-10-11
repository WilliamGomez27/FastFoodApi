import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;
const requiredEnvironmentVariables = ['JWT_SECRET'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Faltan variables de entorno requeridas: ${missingEnvironmentVariables.join(', ')}`
  );
}

if (
  nodeEnv === 'production' &&
  (jwtSecret.length < 32 || jwtSecret === 'change-this-secret')
) {
  throw new Error(
    'JWT_SECRET debe tener al menos 32 caracteres y no puede usar el valor de ejemplo en producción.'
  );
}

/**
 * AUTH_DISABLED: desactiva la autenticación SOLO en desarrollo/test.
 * Si se intenta usar en cualquier otro entorno, el servidor se niega a arrancar.
 */
const authDisabled = String(process.env.AUTH_DISABLED || 'false').toLowerCase() === 'true';
const AUTH_BYPASS_ALLOWED_ENVS = ['development', 'test'];

if (authDisabled && !AUTH_BYPASS_ALLOWED_ENVS.includes(nodeEnv)) {
  throw new Error(
    `AUTH_DISABLED=true no está permitido con NODE_ENV=${nodeEnv}. Solo se admite en development o test.`
  );
}

const defaultFrontendOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501'
];

export function parseFrontendOrigins(value, environment = nodeEnv) {
  if (!value) {
    if (environment === 'production') {
      throw new Error('FRONTEND_ORIGINS es obligatoria en producción.');
    }

    return defaultFrontendOrigins;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('FRONTEND_ORIGINS debe incluir al menos un origen válido.');
  }

  return origins.map((origin) => {
    let url;

    try {
      url = new URL(origin);
    } catch {
      throw new Error(`FRONTEND_ORIGINS contiene un origen inválido: ${origin}`);
    }

    if (url.origin !== origin) {
      throw new Error(`FRONTEND_ORIGINS no debe incluir rutas: ${origin}`);
    }

    if (environment === 'production' && url.protocol !== 'https:') {
      throw new Error(`FRONTEND_ORIGINS debe usar HTTPS en producción: ${origin}`);
    }

    return origin;
  });
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  authDisabled,
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '100kb',
  trustProxy: String(process.env.TRUST_PROXY || 'false').toLowerCase() === 'true',
  frontendOrigins: parseFrontendOrigins(process.env.FRONTEND_ORIGINS),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    // Minúsculas: MySQL en Linux distingue mayúsculas en nombres de BD
    name: process.env.DB_NAME || 'supermarket_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  }
};
