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
      idioma TEXT NOT NULL CHECK(idioma IN ('es', 'en')),
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
      puesto_oferta TEXT NOT NULL DEFAULT '',
      categoria_id INTEGER,
      idioma TEXT CHECK(idioma IN ('es', 'en')),
      nombre_reclutador TEXT NOT NULL DEFAULT '',
      puesto_reclutador TEXT NOT NULL DEFAULT '',
      template_ids TEXT NOT NULL DEFAULT '[]',
      valores_usados TEXT NOT NULL DEFAULT '{}',
      resultado_email TEXT,
      resultado_empresa TEXT,
      resultado_recruiter TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    );
  `);
}

export default db;
