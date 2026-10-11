/**
 * src/app.js
 * Construye la aplicación Express SIN llamar a listen().
 * Así los tests pueden importarla y usar supertest sin abrir puertos.
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { buildRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detrás de Nginx/proxy: necesario para que rate-limit vea la IP real
  if (env.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.frontendOrigins, credentials: true }));
  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(globalLimiter);

  app.use('/api', buildRouter());

  // ─── 404 ────────────────────────────────────────────────────────────────────
  app.use((_request, response) => {
    response.status(404).json({ message: 'Ruta no encontrada' });
  });

  // ─── ERROR HANDLER CENTRALIZADO ─────────────────────────────────────────────
  app.use((error, _request, response, _next) => {
    // Errores del parser JSON (body malformado o demasiado grande)
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ message: 'JSON inválido en el cuerpo de la petición.' });
    }
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ message: 'El cuerpo de la petición es demasiado grande.' });
    }

    if (env.nodeEnv !== 'test') console.error('❌ Error no manejado:', error);

    // No exponer detalles técnicos al cliente
    if (env.nodeEnv === 'development') {
      return response.status(500).json({
        message: 'Error interno del servidor.',
        error: error.message,
        stack: error.stack
      });
    }

    return response.status(500).json({ message: 'Error interno del servidor.' });
  });

  return app;
}

export const app = createApp();
