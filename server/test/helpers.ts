import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, afterAll } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';

export interface TestServer {
  /** Devuelve la app Express ya inicializada y migrada. */
  app: Express;
  /** Ruta de la base SQLite temporal (para inspección si hiciera falta). */
  dbPath: string;
  /** Registra un usuario (si no existe) y devuelve su token JWT. */
  auth: (email?: string) => Promise<string>;
}

/**
 * Cada suite de test obtiene su propio server con base SQLite temporal y aislada.
 * Como `./db` instancia la conexión en el import, seteamos `POSTULATOOL_DB` antes
 * del `import('../src/app')`; Vitest re-evalúa los módulos en cada archivo de test.
 */
export function createTestServer(): TestServer {
  let app!: Express;
  let dbPath = '';
  const registered = new Map<string, string>();

  beforeAll(async () => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'postulatool-test-')), 'test.sqlite');
    process.env.POSTULATOOL_DB = dbPath;
    process.env.JWT_SECRET = 'test-secret';
    const { createApp } = await import('../src/app');
    app = createApp();
  });

  afterAll(async () => {
    try {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    } catch {
      // ya eliminado
    }
  });

  async function auth(email = 'user@test.com'): Promise<string> {
    const key = email.toLowerCase();
    let token = registered.get(key);
    if (!token) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'Str0ng-pass-123' });
      if (res.status !== 201) {
        throw new Error(`register falló en test (${res.status}): ${JSON.stringify(res.body)}`);
      }
      token = (res.body as { token: string }).token;
      registered.set(key, token);
    }
    return token!;
  }

  // Getters: `app`/`dbPath` se asignan dentro de beforeAll (que corre después de
  // construir el objeto). Sin getter, el objeto congelaría `undefined`.
  return {
    get app() {
      return app;
    },
    get dbPath() {
      return dbPath;
    },
    auth,
  } satisfies TestServer;
}