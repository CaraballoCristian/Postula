import { initDB } from '../db';
import db from '../db';
import { hashPassword } from '../auth';
import { seedForUser } from '../seed';

const TABLES = ['categorias', 'templates', 'config', 'idiomas', 'tags', 'postulaciones'];

function main() {
  initDB();
  const email = (process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3] || '';
  if (!email || !password) {
    console.error('Uso: npm run claim:owner -- <email> <password>');
    process.exit(1);
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let userId: number;
  if (existing) {
    userId = existing.id;
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
    console.log(`El usuario ${email} ya existía (id=${userId}); contraseña actualizada.`);
  } else {
    userId = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hashPassword(password)).lastInsertRowid as number;
    console.log(`Usuario ${email} creado (id=${userId}).`);
  }

  const claim = db.transaction(() => {
    for (const t of TABLES) {
      const r = db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`).run(userId);
      if (r.changes > 0) console.log(`  ${t}: ${r.changes} fila(s) sin dueño asignadas a ${email}`);
    }
  });
  claim();

  seedForUser(userId);
  console.log('Defaults (categorias/templates/config/idiomas/tags) verificados y completados si faltaban.');

  const counts = TABLES.map(t => `  ${t}: ${(db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id = ?`).get(userId) as any).c}`).join('\n');
  console.log(`Datos finales del owner ${email}:\n${counts}`);
  console.log('Listo. Ya podés loguearte con ese email.');
}

main();
