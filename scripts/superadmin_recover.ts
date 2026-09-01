import readline from 'readline';
import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, getUsers, updateUser, createAuditLog, revokeAllUserSessions, validatePasswordPolicy } from '../src/server/db.js';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

function readHiddenPassword(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans);
      });
      return;
    }

    process.stdout.write(promptText);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
        return;
      }
      if (char === '\u007f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      if (char === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.log('\nOperación cancelada.');
        process.exit(1);
      }
      if (char >= ' ') {
        password += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

async function runRecovery() {
  console.log('======================================================');
  console.log('🔐 GWEN NAILS - SUPERADMIN LOCAL RECOVERY TOOL');
  console.log('======================================================');

  await initDatabase();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const usernameInput = await askQuestion(rl, 'Ingrese el username del superadministrador a recuperar: ');
    const username = usernameInput.trim();

    if (!username) {
      console.error('❌ Error: El username no puede estar vacío.');
      process.exit(1);
    }

    const users = await getUsers(false);
    const targetUser = users.find(u => u.username?.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === username.toLowerCase());

    if (!targetUser) {
      console.error(`❌ Error: No se encontró ningún usuario con username o email "${username}".`);
      process.exit(1);
    }

    if (targetUser.rol !== 'superadmin') {
      console.error(`❌ Error: El usuario "${username}" existe pero no tiene rol de superadmin (rol actual: ${targetUser.rol}).`);
      process.exit(1);
    }

    rl.close();

    const newPass = await readHiddenPassword('Ingrese la nueva contraseña (mín. 12 caracteres, mayúsculas, minúsculas, números y símbolos): ');
    const policy = validatePasswordPolicy(newPass);
    if (!policy.valid) {
      console.error(`❌ Error: La contraseña no cumple con la política de seguridad: ${policy.error}`);
      process.exit(1);
    }

    const confirmPass = await readHiddenPassword('Confirme la nueva contraseña: ');
    if (newPass !== confirmPass) {
      console.error('❌ Error: Las contraseñas no coinciden.');
      process.exit(1);
    }

    await updateUser(targetUser.id, {
      password: newPass,
      activo: true,
      mustChangePassword: true
    });

    await revokeAllUserSessions(targetUser.id);

    await createAuditLog({
      evento: 'superadmin_recovered_locally',
      targetUserId: targetUser.id,
      metadata: { username: targetUser.username || targetUser.email }
    });

    console.log('======================================================');
    console.log('✅ ¡Superadministrador recuperado con éxito!');
    console.log(`  - Usuario: ${targetUser.username || targetUser.email}`);
    console.log(`  - Estado: Activo (mustChangePassword = true)`);
    console.log(`  - Sesiones anteriores: Revocadas`);
    console.log('======================================================');
  } catch (err) {
    console.error('❌ Error durante la recuperación local:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runRecovery();
