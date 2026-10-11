# Despliegue a producción

## 1. Secretos y variables del servidor

Configura estas variables en el panel seguro del proveedor de hosting. No subas un archivo `.env` ni sus valores al repositorio.

```text
NODE_ENV=production
PORT=3000
JWT_SECRET=<clave-aleatoria-de-al-menos-32-caracteres>
JWT_EXPIRES_IN=1h
FRONTEND_ORIGINS=https://panel.ejemplo.com
DB_HOST=<host-de-mysql>
DB_PORT=3306
DB_NAME=SuperMarket_db
DB_USER=<usuario-de-base-de-datos>
DB_PASSWORD=<contraseña-de-base-de-datos>
DB_CONNECTION_LIMIT=10
```

`FRONTEND_ORIGINS` acepta varios dominios separados por comas, por ejemplo:

```text
FRONTEND_ORIGINS=https://panel.ejemplo.com,https://www.panel.ejemplo.com
```

Incluye únicamente el origen: protocolo y dominio. No añadas rutas como `/api` ni una barra final.

## 2. Configurar el frontend

En `FastFoodFrontend/index.html`, `login.html` y `dashboard.html`, reemplaza el atributo vacío por la URL pública del backend:

```html
<meta name="api-base-url" content="https://api.ejemplo.com/api">
```

Los tres archivos deben usar exactamente la misma URL.

## 3. Arrancar y comprobar

Instala las dependencias y ejecuta:

```powershell
npm ci
npm start
```

Después verifica:

- `GET https://api.ejemplo.com/api/health` responde `200`.
- El inicio de sesión funciona desde el dominio incluido en `FRONTEND_ORIGINS`.
- `POST /api/auth/dev-token` responde `404`, ya que solo existe en desarrollo.
- Un origen que no esté en `FRONTEND_ORIGINS` no puede acceder desde el navegador.

## 4. Reglas de seguridad aplicadas

- El servidor no inicia en producción sin `FRONTEND_ORIGINS`.
- El servidor no inicia con una clave JWT de ejemplo o menor de 32 caracteres.
- Los orígenes de producción deben usar HTTPS.
- Los errores de base de datos no revelan detalles técnicos al cliente en producción.
