import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcrypt';
import { databasePool } from '../config/database.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function promptText(question) {
  const readline = createInterface({ input, output });

  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

async function promptHidden(question) {
  if (!input.isTTY) {
    throw new Error('Este comando debe ejecutarse desde una terminal interactiva.');
  }

  output.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanUp = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    };

    const onData = (key) => {
      if (key === '\u0003') {
        cleanUp();
        reject(new Error('Operación cancelada.'));
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanUp();
        resolve(value);
        return;
      }

      if (key === '\b' || key === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      if (key >= ' ') value += key;
    };

    input.on('data', onData);
  });
}

async function resetAdmin() {
  const email = await promptText('Nuevo correo del administrador: ');
  const password = await promptHidden('Nueva contraseña: ');
  const confirmation = await promptHidden('Confirma la nueva contraseña: ');

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('El correo no tiene un formato válido.');
  }

  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password !== confirmation) {
    throw new Error('Las contraseñas no coinciden.');
  }

  const [admins] = await databasePool.query(
    'SELECT id FROM users WHERE role = ? ORDER BY id',
    ['admin']
  );

  if (admins.length > 1) {
    throw new Error(
      'El restablecimiento requiere exactamente un administrador. Revisa la tabla users antes de continuar.'
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    if (admins.length === 0) {
      // BD recién inicializada: crear el primer administrador
      await databasePool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Administrador', email.toLowerCase(), passwordHash, 'admin']
      );
      console.log('Administrador inicial creado correctamente.');
      return;
    }

    await databasePool.query(
      'UPDATE users SET email = ?, password = ? WHERE id = ?',
      [email.toLowerCase(), passwordHash, admins[0].id]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Ya existe una cuenta con ese correo.', { cause: error });
    }
    throw error;
  }

  console.log('Credenciales del administrador restablecidas correctamente.');
}

try {
  await resetAdmin();
} catch (error) {
  console.error(`No se restablecieron las credenciales: ${error.message}`);
  process.exitCode = 1;
} finally {
  await databasePool.end();
}
