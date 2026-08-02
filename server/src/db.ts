import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'postulatool.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL,
      idioma TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('email', 'mensaje_empresa', 'mensaje_recruiter')),
      nombre TEXT NOT NULL,
      contenido TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      valor TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS postulaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL,
      oferta_laboral TEXT NOT NULL DEFAULT '',
      categoria_id INTEGER,
      idioma TEXT,
      nombre_empleado TEXT NOT NULL DEFAULT '',
      puesto_empleado TEXT NOT NULL DEFAULT '',
      template_ids TEXT NOT NULL DEFAULT '[]',
      valores_usados TEXT NOT NULL DEFAULT '{}',
      resultado_email TEXT,
      resultado_empresa TEXT,
      resultado_recruiter TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS idiomas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const addColumns = [
    'ALTER TABLE postulaciones ADD COLUMN notas TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN estado TEXT NOT NULL DEFAULT \'solicitado\'',
    'ALTER TABLE postulaciones ADD COLUMN link_empresa TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN contacto_empleado TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0',
  ];
  for (const sql of addColumns) {
    try { db.exec(sql); } catch (e: any) {
      if (!e.message?.includes('duplicate column')) throw e;
    }
  }

  const renameColumns: [string, string][] = [
    ['puesto_oferta', 'oferta_laboral'],
    ['nombre_reclutador', 'nombre_empleado'],
    ['puesto_reclutador', 'puesto_empleado'],
  ];
  for (const [old, newName] of renameColumns) {
    try { db.exec(`ALTER TABLE postulaciones RENAME COLUMN ${old} TO ${newName}`); } catch (e: any) {
      if (!e.message?.includes('no such column') && !e.message?.includes('duplicate column')) throw e;
    }
  }

  const placeholderRenames: [string, string][] = [
    ['{oferta}', '{oferta_laboral}'],
    ['{nombre_reclutador}', '{nombre_empleado}'],
    ['{puesto_reclutador}', '{puesto_empleado}'],
  ];
  for (const [old, newPh] of placeholderRenames) {
    db.prepare(`UPDATE templates SET contenido = REPLACE(contenido, ?, ?) WHERE contenido LIKE ?`).run(old, newPh, `%${old}%`);
  }

  // Migration: remove CHECK on templates.idioma for existing DBs
  try {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE IF NOT EXISTS templates_mig (
        id INTEGER PRIMARY KEY,
        categoria_id INTEGER NOT NULL,
        idioma TEXT NOT NULL,
        tipo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        contenido TEXT NOT NULL,
        orden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO templates_mig (id, categoria_id, idioma, tipo, nombre, contenido, orden, created_at, updated_at)
        SELECT id, categoria_id, idioma, tipo, nombre, contenido, orden, created_at, updated_at FROM templates;
      DROP TABLE templates;
      ALTER TABLE templates_mig RENAME TO templates;
      PRAGMA foreign_keys=ON;
    `);
  } catch { /* already migrated */ }

  // Migration: remove CHECK on postulaciones.idioma for existing DBs
  try {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE IF NOT EXISTS postulaciones_mig (
        id INTEGER PRIMARY KEY,
        empresa TEXT NOT NULL,
        oferta_laboral TEXT NOT NULL DEFAULT '',
        categoria_id INTEGER,
        idioma TEXT,
        nombre_empleado TEXT NOT NULL DEFAULT '',
        puesto_empleado TEXT NOT NULL DEFAULT '',
        template_ids TEXT NOT NULL DEFAULT '[]',
        valores_usados TEXT NOT NULL DEFAULT '{}',
        resultado_email TEXT,
        resultado_empresa TEXT,
        resultado_recruiter TEXT,
        notas TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL DEFAULT 'solicitado',
        link_empresa TEXT NOT NULL DEFAULT '',
        contacto_empleado TEXT NOT NULL DEFAULT '',
        favorito INTEGER NOT NULL DEFAULT 0,
        fecha TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
      );
      INSERT OR IGNORE INTO postulaciones_mig (id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, fecha, created_at)
        SELECT id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, fecha, created_at FROM postulaciones;
      DROP TABLE postulaciones;
      ALTER TABLE postulaciones_mig RENAME TO postulaciones;
      PRAGMA foreign_keys=ON;
    `);
  } catch { /* already migrated */ }

  // Migration: create idiomas table for existing DBs
  try { db.exec('CREATE TABLE IF NOT EXISTS idiomas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'); } catch {}

  // Migration: rename idiomas es→ESP, en→ENG + update templates and postulaciones
  try { db.exec("UPDATE idiomas SET nombre='ESP' WHERE nombre='es'"); } catch {}
  try { db.exec("UPDATE idiomas SET nombre='ENG' WHERE nombre='en'"); } catch {}
  try { db.exec("UPDATE templates SET idioma='ESP' WHERE idioma='es'"); } catch {}
  try { db.exec("UPDATE templates SET idioma='ENG' WHERE idioma='en'"); } catch {}
  try { db.exec("UPDATE postulaciones SET idioma='ESP' WHERE idioma='es'"); } catch {}
  try { db.exec("UPDATE postulaciones SET idioma='ENG' WHERE idioma='en'"); } catch {}

  // Migration: insert default config values for existing DBs
  try { db.exec("INSERT OR IGNORE INTO config (clave, valor) SELECT 'default_categoria_id', CAST(id AS TEXT) FROM categorias LIMIT 1"); } catch {}
  try { db.exec("INSERT OR IGNORE INTO config (clave, valor) SELECT 'default_idioma', nombre FROM idiomas LIMIT 1"); } catch {}

  // Migration: create tags table for existing DBs
  try { db.exec('CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, color TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'); } catch {}

  // Migration: repair postulaciones column misalignment caused by an old rebuild that copied by position
  try {
    // Pattern A: estado/notas hold a date (fecha/created_at shifted into them)
    db.prepare(`
      UPDATE postulaciones SET
        fecha = notas,
        created_at = estado,
        notas = link_empresa,
        estado = contacto_empleado,
        link_empresa = favorito,
        contacto_empleado = fecha,
        favorito = created_at
      WHERE favorito NOT IN (0, 1) AND estado GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
    `).run();
    // Pattern B: estado holds notas text, link_empresa holds the real estado, etc.
    db.prepare(`
      UPDATE postulaciones SET
        estado = link_empresa,
        notas = estado,
        link_empresa = contacto_empleado,
        contacto_empleado = favorito,
        favorito = fecha,
        fecha = notas
      WHERE favorito NOT IN (0, 1) AND estado NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
    `).run();
  } catch { /* sin tabla aún */ }

  // Migration: normalize tag names (slugify + collapse case-insensitive duplicates) and remap postulaciones.estado
  try {
    const slugify = (name: string) => name.trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
    const tags = db.prepare('SELECT * FROM tags ORDER BY id ASC').all() as any[];
    const byKey = new Map<string, string>();
    for (const t of tags) {
      const key = slugify(t.nombre);
      if (!key) continue;
      if (byKey.has(key)) {
        db.prepare('UPDATE postulaciones SET estado = ? WHERE lower(estado) = lower(?)').run(byKey.get(key), t.nombre);
        db.prepare('DELETE FROM tags WHERE id = ?').run(t.id);
      } else {
        db.prepare('UPDATE postulaciones SET estado = ? WHERE lower(estado) = lower(?)').run(key, t.nombre);
        db.prepare('UPDATE tags SET nombre = ? WHERE id = ?').run(key, t.id);
        byKey.set(key, key);
      }
    }
  } catch { /* ya migrado o sin datos */ }
}

export default db;
