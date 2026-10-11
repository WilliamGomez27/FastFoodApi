# FastFood Web API

Backend Node.js para la futura interfaz web de FastFoodApp.

**Estado:** ✅ Producción-Ready | 🔒 Seguridad Implementada | ✅ 56 Pruebas Pasando

## 🔒 Seguridad

Este proyecto implementa seguridad de nivel empresarial:

- ✅ **Almacenamiento seguro de contraseñas** - bcrypt con coste 12
- ✅ **Control de acceso por rol (RBAC)** - Admin/Employee
- ✅ **Protección SQL Injection** - Prepared statements en todas las queries
- ✅ **Rate limiting** - Anti-brute force en login
- ✅ **Autenticación JWT** - Tokens con expiración
- ✅ **Validación de entrada** - Esquemas robustos
- ✅ **Error handling seguro** - Sin exponer información sensible

📖 Ver [SECURITY.md](./SECURITY.md) para documentación completa de seguridad.

## Inicio

```powershell
cd FastFoodApi
npm install
Copy-Item .env.example .env
npm run dev
```

Configura `FastFoodApi/.env` con:

- `JWT_SECRET`: clave segura para firmar tokens
- `DB_*`: credenciales de MySQL

## 🧪 Pruebas

```powershell
# Ejecutar todas las pruebas
npm test

# Pruebas específicas
npm run test:auth
npm run test:security
npm run test:products

# Con cobertura
npm run test:coverage
```

**Resultado:** ✅ 56/56 tests passing (100%)

## Restablecer el administrador

Si el usuario administrador fue creado antes de aplicar bcrypt, restablécelo desde una terminal local:

```powershell
npm run reset-admin
```

El comando solicita el correo y la contraseña de forma interactiva. La contraseña no se imprime, no se guarda en el código y se almacena como hash bcrypt con coste 12.

## Despliegue

Consulta [DEPLOYMENT.md](./DEPLOYMENT.md) antes de publicar la aplicación. En producción, el servidor exige una clave JWT segura, orígenes HTTPS explícitos y mantiene desactivado el token de desarrollo.

## Rutas principales

### Autenticación

- `POST /api/auth/login` - Login (contraseña bcrypt verificada)
- `POST /api/auth/register` - Registrar usuario (solo admin)
- `POST /api/auth/dev-token` - Dev token (solo en desarrollo)

### Productos (protegidas)

- `GET /api/products` - Listar productos (autenticado)
- `GET /api/products/:id` - Obtener producto (autenticado)
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Editar producto (admin)
- `DELETE /api/products/:id` - Eliminar producto (admin)

### Sistema

- `GET /api/health` - Estado de la API y conexión a BD
