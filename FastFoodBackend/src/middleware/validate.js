/**
 * src/middleware/validate.js
 * Validadores de entrada para sanitizar y verificar el body de los requests.
 * Protege contra datos malformados y reduce la superficie de ataque.
 */

// Valida formato de email básico
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Retorna un objeto { valid, errors } con los errores encontrados.
 * @param {object} data  - Campos a validar
 * @param {object} rules - { campo: { required, maxLength, minLength, type, min, max, enum } }
 *   type: 'string' | 'email' | 'number' | 'integer' | 'boolean' | 'url' | 'object'
 */
export function validateSchema(data, rules) {
  const errors = [];
  const source = data && typeof data === 'object' ? data : {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = source[field];
    const isEmpty = value === undefined || value === null || String(value).trim() === '';

    if (rule.required && isEmpty) {
      errors.push(`El campo "${field}" es obligatorio.`);
      continue;
    }

    if (isEmpty) continue; // Campo opcional vacío → ok

    if (rule.type === 'email') {
      if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
        errors.push(`El campo "${field}" debe ser un email válido.`);
      } else if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`"${field}" no puede superar ${rule.maxLength} caracteres.`);
      }
    }

    if (rule.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`El campo "${field}" debe ser texto.`);
        continue;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`"${field}" no puede superar ${rule.maxLength} caracteres.`);
      }
      if (rule.minLength && value.trim().length < rule.minLength) {
        errors.push(`"${field}" debe tener al menos ${rule.minLength} caracteres.`);
      }
    }

    if (rule.type === 'url') {
      let ok = false;
      try {
        const url = new URL(String(value));
        ok = url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        // no es URL válida
      }
      if (!ok) {
        errors.push(`El campo "${field}" debe ser una URL http(s) válida.`);
      } else if (rule.maxLength && String(value).length > rule.maxLength) {
        errors.push(`"${field}" no puede superar ${rule.maxLength} caracteres.`);
      }
    }

    if (rule.type === 'number' || rule.type === 'integer') {
      const num = typeof value === 'boolean' ? NaN : Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`El campo "${field}" debe ser un número.`);
      } else if (rule.type === 'integer' && !Number.isInteger(num)) {
        errors.push(`El campo "${field}" debe ser un número entero.`);
      } else {
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`"${field}" debe ser mayor o igual a ${rule.min}.`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`"${field}" no puede ser mayor a ${rule.max}.`);
        }
      }
    }

    if (rule.type === 'boolean' && ![true, false, 0, 1, '0', '1', 'true', 'false'].includes(value)) {
      errors.push(`El campo "${field}" debe ser verdadero o falso.`);
    }

    if (rule.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push(`El campo "${field}" debe ser un objeto.`);
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`"${field}" debe ser uno de: ${rule.enum.join(', ')}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── ESQUEMAS PRE-DEFINIDOS ───────────────────────────────────────────────────

const passwordRule = { required: true, type: 'string', minLength: 8, maxLength: 128 };
const permisoRule = { type: 'boolean' };

export const schemas = {
  login: {
    email:    { required: true, type: 'email', maxLength: 100 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 128 }
  },
  register: {
    name:     { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email:    { required: true, type: 'email', maxLength: 100 },
    password: passwordRule,
    role:     { type: 'string', enum: ['admin', 'employee'] }
  },
  createUser: {
    name:     { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email:    { required: true, type: 'email', maxLength: 100 },
    password: passwordRule,
    role:     { type: 'string', enum: ['admin', 'employee'] },
    permisos: { type: 'object' }
  },
  permisos: {
    puede_ventas:     permisoRule,
    puede_inventario: permisoRule,
    puede_compras:    permisoRule,
    puede_clientes:   permisoRule,
    puede_reportes:   permisoRule
  },
  product: {
    name:         { required: true, type: 'string', minLength: 2, maxLength: 100 },
    price:        { required: true, type: 'number', min: 0, max: 99999 },
    description:  { type: 'string', maxLength: 1000 },
    category_id:  { type: 'integer', min: 1 },
    image_url:    { type: 'url', maxLength: 255 },
    is_available: { type: 'boolean' },
    stock_minimo: { type: 'integer', min: 0, max: 1000000 },
    unidades_paq: { type: 'integer', min: 1, max: 100000 }
  },
  category: {
    name:        { required: true, type: 'string', minLength: 2, maxLength: 100 },
    description: { type: 'string', maxLength: 1000 }
  },
  stockAdjust: {
    stock_actual: { required: true, type: 'integer', min: 0, max: 1000000 },
    motivo:       { type: 'string', maxLength: 255 }
  }
};

/**
 * Middleware factory: valida el body de un request contra un esquema.
 * Uso: app.post('/ruta', validateBody(schemas.login), handler)
 */
export function validateBody(schema) {
  return (request, response, next) => {
    const { valid, errors } = validateSchema(request.body || {}, schema);
    if (!valid) {
      return response.status(400).json({ message: errors[0], errors });
    }
    return next();
  };
}

/**
 * Middleware factory: valida que los parámetros de ruta indicados sean
 * enteros positivos (evita consultas con ids basura como "1 OR 1=1").
 * Uso: router.get('/:id', validateIdParams('id'), handler)
 */
export function validateIdParams(...names) {
  return (request, response, next) => {
    for (const name of names) {
      const raw = request.params?.[name];
      if (!/^[1-9]\d{0,9}$/.test(String(raw))) {
        return response.status(400).json({ message: `El parámetro "${name}" debe ser un entero positivo.` });
      }
      request.params[name] = Number(raw);
    }
    return next();
  };
}
