import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.POSTULATOOL_DB || path.join(DATA_DIR, 'postulatool.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function userVersion(): number {
  return db.pragma('user_version', { simple: true }) as number;
}

function setUserVersion(v: number) {
  db.pragma(`user_version = ${v}`);
}

function hasColumn(table: string, column: string): boolean {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c: any) => c.name === column);
}

function tableSql(table: string): string {
  return (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(table) as any)?.sql ?? '';
}

function hasCheck(table: string): boolean {
  return /CHECK\s*\(/.test(tableSql(table));
}

/** Migraciones versionadas. Cada paso es idempotente (con guardas estructurales),
 *  de modo que puede ejecutarse sin destrucción sobre una DB ya migrada. */
const MIGRATIONS: { version: number; name: string; up: () => void }[] = [];

let CURRENT_VERSION = 0;
function addMigration(name: string, up: () => void) {
  CURRENT_VERSION += 1;
  MIGRATIONS.push({ version: CURRENT_VERSION, name, up });
}

// ── v1: esquema base (idempotente) ──
addMigration('esquema base', () => {
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
      tipo TEXT NOT NULL,
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
      notas TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'solicitado',
      link_empresa TEXT NOT NULL DEFAULT '',
      contacto_empleado TEXT NOT NULL DEFAULT '',
      favorito INTEGER NOT NULL DEFAULT 0,
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
});

// ── v2: columnas que se agregaron con el tiempo ──
addMigration('columnas agregadas de postulaciones', () => {
  for (const col of [
    'ALTER TABLE postulaciones ADD COLUMN notas TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN estado TEXT NOT NULL DEFAULT \'solicitado\'',
    'ALTER TABLE postulaciones ADD COLUMN link_empresa TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN contacto_empleado TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE postulaciones ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0',
  ]) {
    try { db.exec(col); } catch (e: any) {
      if (!e.message?.includes('duplicate column')) throw e;
    }
  }
});

// ── v3: renombre de columnas heredado ──
addMigration('renombre de columnas heredado', () => {
  for (const [old, newName] of [
    ['puesto_oferta', 'oferta_laboral'],
    ['nombre_reclutador', 'nombre_empleado'],
    ['puesto_reclutador', 'puesto_empleado'],
  ]) {
    try { db.exec(`ALTER TABLE postulaciones RENAME COLUMN ${old} TO ${newName}`); } catch (e: any) {
      if (!e.message?.includes('no such column') && !e.message?.includes('duplicate column')) throw e;
    }
  }
});

// ── v4: renombres de placeholders heredados ──
addMigration('renombre de placeholders heredados', () => {
  for (const [oldPh, newPh] of [
    ['{oferta}', '{oferta_laboral}'],
    ['{nombre_reclutador}', '{nombre_empleado}'],
    ['{puesto_reclutador}', '{puesto_empleado}'],
  ]) {
    db.prepare(`UPDATE templates SET contenido = REPLACE(contenido, ?, ?) WHERE contenido LIKE ?`).run(oldPh, newPh, `%${oldPh}%`);
  }
});

// ── v5: quitar CHECK de templates.idioma ──
addMigration('quitar CHECK de tipo en templates', () => {
  if (!hasCheck('templates')) return;
  db.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE templates_mig (
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
});

// ── v6: quitar CHECK de postulaciones ──
addMigration('quitar CHECK de postulaciones', () => {
  if (!hasCheck('postulaciones')) return;
  db.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE postulaciones_mig (
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
});

// ── v7: normalizar idiomas es/en → ESP/ENG ──
addMigration('normalizar idiomas es/en → ESP/ENG', () => {
  db.exec("UPDATE idiomas SET nombre='ESP' WHERE nombre='es'");
  db.exec("UPDATE idiomas SET nombre='ENG' WHERE nombre='en'");
  db.exec("UPDATE templates SET idioma='ESP' WHERE idioma='es'");
  db.exec("UPDATE templates SET idioma='ENG' WHERE idioma='en'");
  db.exec("UPDATE postulaciones SET idioma='ESP' WHERE idioma='es'");
  db.exec("UPDATE postulaciones SET idioma='ENG' WHERE idioma='en'");
});

// ── v8: config defaults heredados ──
addMigration('insertar config defaults', () => {
  db.exec("INSERT OR IGNORE INTO config (clave, valor) SELECT 'default_categoria_id', CAST(id AS TEXT) FROM categorias LIMIT 1");
  db.exec("INSERT OR IGNORE INTO config (clave, valor) SELECT 'default_idioma', nombre FROM idiomas LIMIT 1");
});

// ── v9: reparación de corrimiento de columnas (bug legado) ──
addMigration('reparar corrimiento de columnas legacy', () => {
  if (!hasColumn('postulaciones', 'notas')) return;
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
});

// ── v10: normalizar tags (slugify + colapsar duplicados) ──
addMigration('normalizar tags existentes', () => {
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
});

// ── v11: FK real de tags sobre postulaciones.estado ──
addMigration('FK de tags en postulaciones', () => {
  // Rebuild de postulaciones agregando la FK hacia tags(nombre). No-op si ya está.
  const fk = /REFERENCES\s+tags\s*\(\s*nombre\s*\)/i.test(tableSql('postulaciones'));
  if (fk) return;
  // Reconciliación defensiva: cualquier estado huérfano se asigna al primer tag para no perder filas.
  db.prepare(`
    UPDATE postulaciones SET estado = (
      SELECT nombre FROM tags ORDER BY id LIMIT 1
    )
    WHERE estado NOT IN (SELECT nombre FROM tags)
  `).run();
  db.exec(`
    CREATE TABLE postulaciones_fk (
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
      notas TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'solicitado',
      link_empresa TEXT NOT NULL DEFAULT '',
      contacto_empleado TEXT NOT NULL DEFAULT '',
      favorito INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
      FOREIGN KEY (estado) REFERENCES tags(nombre) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    INSERT OR IGNORE INTO postulaciones_fk (id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, fecha, created_at)
      SELECT id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, fecha, created_at FROM postulaciones;
    DROP TABLE postulaciones;
    ALTER TABLE postulaciones_fk RENAME TO postulaciones;
  `);
});

// ── v12: papelera → borrado blando via deleted_at ──
addMigration('papelera (deleted_at en postulaciones)', () => {
  if (hasColumn('postulaciones', 'deleted_at')) return;
  db.exec(`ALTER TABLE postulaciones ADD COLUMN deleted_at TEXT`);
});

// ── v13: multi-usuario (users + user_id + UNIQUEs compuestos + FK compuesta) ──
addMigration('multi-usuario (users, user_id, UNIQUEs compuestos)', () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Columna user_id en las tablas de datos. Nullable: los datos históricos
  // se asignan al owner con el script claim-owner.
  for (const t of ['categorias', 'templates', 'config', 'postulaciones', 'idiomas', 'tags']) {
    if (!hasColumn(t, 'user_id')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN user_id INTEGER`);
    }
  }

  // Rebuild de tablas cuyo UNIQUE simple pasa a compuesto (user_id, nombre/clave).
  // IMPORTANTE: correr con foreign_keys=OFF global (ver initDB) porque acá se dropea
  // `tags`, que es padre de la FK de postulaciones.
  db.exec(`
    CREATE TABLE categorias_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, nombre)
    );
    INSERT OR IGNORE INTO categorias_mig (id, nombre, user_id, created_at)
      SELECT id, nombre, user_id, created_at FROM categorias;
    DROP TABLE categorias;
    ALTER TABLE categorias_mig RENAME TO categorias;

    CREATE TABLE idiomas_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, nombre)
    );
    INSERT OR IGNORE INTO idiomas_mig (id, nombre, user_id, created_at)
      SELECT id, nombre, user_id, created_at FROM idiomas;
    DROP TABLE idiomas;
    ALTER TABLE idiomas_mig RENAME TO idiomas;

    CREATE TABLE tags_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, nombre)
    );
    INSERT OR IGNORE INTO tags_mig (id, nombre, color, user_id, created_at)
      SELECT id, nombre, color, user_id, created_at FROM tags;
    DROP TABLE tags;
    ALTER TABLE tags_mig RENAME TO tags;

    CREATE TABLE config_mig (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL,
      valor TEXT NOT NULL DEFAULT '',
      user_id INTEGER,
      UNIQUE (user_id, clave)
    );
    INSERT OR IGNORE INTO config_mig (id, clave, valor, user_id)
      SELECT id, clave, valor, user_id FROM config;
    DROP TABLE config;
    ALTER TABLE config_mig RENAME TO config;

    CREATE TABLE postulaciones_mig (
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
      notas TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'solicitado',
      link_empresa TEXT NOT NULL DEFAULT '',
      contacto_empleado TEXT NOT NULL DEFAULT '',
      favorito INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      user_id INTEGER,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id, estado) REFERENCES tags(user_id, nombre) ON DELETE RESTRICT ON UPDATE CASCADE
    );
    INSERT OR IGNORE INTO postulaciones_mig (id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, deleted_at, user_id, fecha, created_at)
      SELECT id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado, template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado, link_empresa, contacto_empleado, favorito, deleted_at, user_id, fecha, created_at FROM postulaciones;
    DROP TABLE postulaciones;
    ALTER TABLE postulaciones_mig RENAME TO postulaciones;
  `);
});

// ── v14: renombrar variables de datos personales (mi_* → capitalizadas) ──
addMigration('renombrar variables de datos personales', () => {
  const miMap: [string, string][] = [
    ['mi_nombre', 'Nombre'],
    ['mi_linkedin', 'Linkedin'],
    ['mi_telefono', 'Telefono'],
    ['mi_portfolio', 'Portfolio'],
    ['mi_email', 'Email'],
  ];
  for (const [oldK, newK] of miMap) {
    db.prepare('UPDATE config SET clave = ? WHERE clave = ?').run(newK, oldK);
    db.prepare('UPDATE templates SET contenido = replace(contenido, ?, ?) WHERE contenido LIKE ?')
      .run(`{${oldK}}`, `{${newK}}`, `%{${oldK}}%`);
  }
});

// ── v15: normalizar variables de datos personales legacy (minúsculas → capitalizadas) ──
addMigration('normalizar variables de datos personales legacy', () => {
  const legacyMap: [string, string][] = [
    ['nombre', 'Nombre'],
    ['linkedin', 'Linkedin'],
    ['telefono', 'Telefono'],
    ['portfolio', 'Portfolio'],
    ['email', 'Email'],
  ];
  for (const [oldK, newK] of legacyMap) {
    // Evita conflicto UNIQUE si ya existiera la clave capitalizada para ese usuario.
    db.prepare('UPDATE config SET clave = ? WHERE clave = ? AND NOT EXISTS (SELECT 1 FROM config c2 WHERE c2.clave = ? AND c2.user_id IS config.user_id)')
      .run(newK, oldK, newK);
    db.prepare('UPDATE templates SET contenido = replace(contenido, ?, ?) WHERE contenido LIKE ?')
      .run(`{${oldK}}`, `{${newK}}`, `%{${oldK}}%`);
  }
});

/** Ejecuta las migraciones pendientes y avanza `user_version`. */
export function initDB() {
  const from = userVersion();
  const pending = MIGRATIONS.filter(m => m.version > from).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;
  const apply = db.transaction(() => {
    for (const m of pending) {
      m.up();
      setUserVersion(m.version);
    }
  });
  // Las migraciones dropean tablas padre (tags → postulaciones.estado); el pragma
  // de foreign_keys solo es efectivo FUERA de una transacción, así que se setea acá.
  db.pragma('foreign_keys = OFF');
  try {
    apply();
  } catch (e) {
    console.error(`Migración de esquema fallida (user_version=${userVersion()}):`, e);
    throw e;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export default db;