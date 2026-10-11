#!/usr/bin/env node
/**
 * src/scripts/verifySecurity.js
 * Verificador de calidad y seguridad — ejecuta comprobaciones REALES:
 *   1. Lint (ESLint + eslint-plugin-security)
 *   2. Pruebas unitarias, de API y de seguridad
 *   3. npm audit (vulnerabilidades en dependencias de producción)
 *   4. Escaneo de patrones peligrosos en el código fuente
 *   5. Revisión de configuración (.env)
 *
 * Uso: npm run verify-security
 * Sale con código 1 si alguna comprobación falla (apto para CI).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const c = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };
const log = (msg, color = 'reset') => console.log(`${c[color]}${msg}${c.reset}`);
const header = (title) => { log(`\n${'═'.repeat(70)}`, 'cyan'); log(title, 'bold'); log('═'.repeat(70), 'cyan'); };

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(label, command, args) {
  log(`\n▶ ${label}`, 'cyan');
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const ok = result.status === 0;
  log(ok ? `✅ ${label}: OK` : `❌ ${label}: FALLÓ`, ok ? 'green' : 'red');
  return ok;
}

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : listJsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Patrones que no deberían aparecer en código de producción. */
const DANGEROUS_PATTERNS = [
  { regex: /\beval\s*\(/, message: 'uso de eval()' },
  { regex: /new\s+Function\s*\(/, message: 'uso de new Function()' },
  { regex: /query\(\s*`[^`]*\$\{(?!PERMISOS_VALIDOS|PRODUCT_COLUMNS|USER_SELECT)[^}]*\}[^`]*`/, message: 'interpolación en SQL (usar ? / ??)', onlyIn: /controllers|middleware|routes/ },
  { regex: /error\.message\s*[,}]/, message: 'posible fuga de error.message al cliente', onlyIn: /controllers/ },
  { regex: /jwt\.sign\([^)]*['"]secret['"]/, message: 'secreto JWT hardcodeado' }
];

function scanSource() {
  header('4️⃣  ESCANEO DE PATRONES PELIGROSOS');
  let ok = true;
  for (const file of listJsFiles('src')) {
    if (file.includes(`scripts${path.sep}verifySecurity.js`)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const { regex, message, onlyIn } of DANGEROUS_PATTERNS) {
      if (onlyIn && !onlyIn.test(file)) continue;
      if (regex.test(content)) {
        log(`❌ ${file}: ${message}`, 'red');
        ok = false;
      }
    }
  }
  if (ok) log('✅ No se encontraron patrones peligrosos', 'green');
  return ok;
}

function checkEnv() {
  header('5️⃣  CONFIGURACIÓN DE ENTORNO');
  if (!fs.existsSync('.env')) {
    log('⚠️  No hay .env (se usarán variables del sistema)', 'yellow');
    return true;
  }
  const vars = Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );

  let ok = true;
  const isProd = vars.NODE_ENV === 'production';
  if (!vars.JWT_SECRET || vars.JWT_SECRET === 'change-this-secret' || vars.JWT_SECRET.length < 32) {
    log(`${isProd ? '❌' : '⚠️ '} JWT_SECRET débil o de ejemplo (usa ≥ 32 caracteres aleatorios)`, isProd ? 'red' : 'yellow');
    if (isProd) ok = false;
  } else {
    log('✅ JWT_SECRET con longitud adecuada', 'green');
  }
  if (vars.AUTH_DISABLED === 'true') {
    log(`${isProd ? '❌' : '⚠️ '} AUTH_DISABLED=true (autenticación desactivada)`, isProd ? 'red' : 'yellow');
    if (isProd) ok = false;
  }
  if (!vars.DB_PASSWORD) log('⚠️  DB_PASSWORD vacío', 'yellow');
  if (vars.DB_USER === 'root') log('⚠️  DB_USER=root: crea un usuario con privilegios mínimos', 'yellow');
  return ok;
}

header('🔒 VERIFICADOR DE CALIDAD Y SEGURIDAD — FASTFOODAPI');

const results = {
  lint: (header('1️⃣  LINT'), run('ESLint', npm, ['run', 'lint', '--silent'])),
  tests: (header('2️⃣  PRUEBAS'), run('Pruebas unitarias + API + seguridad', npm, ['test', '--silent'])),
  audit: (header('3️⃣  DEPENDENCIAS'), run('npm audit (prod, nivel high)', npm, ['audit', '--omit=dev', '--audit-level=high'])),
  source: scanSource(),
  env: checkEnv()
};

header('📊 RESUMEN');
for (const [name, ok] of Object.entries(results)) log(`${ok ? '✅' : '❌'} ${name}`, ok ? 'green' : 'red');
const passed = Object.values(results).every(Boolean);
log(passed ? '\n🎉 Todas las verificaciones pasaron.' : '\n❌ Hay verificaciones fallidas.', passed ? 'green' : 'red');
process.exit(passed ? 0 : 1);
