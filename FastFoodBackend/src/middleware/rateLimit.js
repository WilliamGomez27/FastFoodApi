/**
 * src/middleware/rateLimit.js
 * Limitadores de tasa para proteger contra fuerza bruta y abuso de la API.
 */
import rateLimit from 'express-rate-limit';

/**
 * loginLimiter: Máx 10 intentos de login por IP en 15 minutos.
 * Si se supera, bloquea por el tiempo restante con respuesta 429.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
  },
  skipSuccessfulRequests: true // Solo cuenta los intentos FALLIDOS
});

/**
 * globalLimiter: Límite general de 300 req/min por IP.
 * Protege contra abuso generalizado de la API.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiadas peticiones. Intenta de nuevo en un momento.'
  }
});
