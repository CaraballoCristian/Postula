import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
}

export type CrudOptions = {
  /** Nombre de la tabla (constante interna, nunca input del usuario). */
  table: string;
  /** Mensaje para UNIQUE constraint → 409. */
  conflict: string;
  /** Mensaje para fila inexistente → 404. */
  notFound: string;
  /** Mensaje para nombre vacío → 400. */
  required: string;
  createError: string;
  updateError: string;
  /** ORDER BY de la lista. Default: `created_at ASC`. */
  orderBy?: string;
  /** Columnas extra copiadas del body (ej: `color`). */
  extraCols?: string[];
  /** Normaliza el nombre con slugify (tags). */
  slug?: boolean;
  /** Clave en `config` que expone `PUT /:id/default`. */
  defaultKey?: string;
  /** Qué guardar como default: el id de la fila (default) o su nombre (idiomas). */
  defaultOf?: 'id' | 'nombre';
  /** Requiere `nombre` siempre en PUT (categorías/idiomas). Tags lo permiten opcional. */
  requireNombreOnUpdate?: boolean;
  /** DELETE sin destino devuelve 404 si no existe. Tags lo dejan idempotente (`false`). */
  notFoundOnDelete?: boolean;
  /** Rename propaga a otra tabla (tags → postulaciones.estado). */
  propagateOnRename?: { table: string; column: string };
  /** DELETE puede reasignar referencias antes de borrar (tags, categorías). */
  reassignOnDelete?: { table: string; column: string };
  /** Cómo referencia la otra tabla esta fila: por `nombre` (tags) o por `id` (categorías). */
  reassignRefKind?: 'nombre' | 'id';
  /** Mensajes para errores de reasignación. */
  reassignErrors?: { destNotFound: string; same: string };
};

/**
 * Factory de CRUD para tablas simples de usuario (categorias, idiomas, tags).
 * Endpoints: GET /, POST /, PUT /:id, DELETE /:id y PUT /:id/default (opcional).
 * Respeta UNIQUE→409, mensajes de error, default por configuración y (en tags)
 * propagación de rename/reasignación sobre postulaciones.
 */
export default function crudFactory(opts: CrudOptions): Router {
  const {
    table,
    conflict,
    notFound,
    required,
    createError,
    updateError,
  } = opts;
  const orderBy = opts.orderBy ?? 'created_at ASC';
  const extraCols = opts.extraCols ?? [];
  const normalize = (raw: unknown) => {
    const s = raw == null ? '' : String(raw);
    return opts.slug ? slugify(s) : s.trim();
  };

  const router = Router();
  router.use(requireAuth);

  router.get('/', (req: AuthRequest, res: Response) => {
    const rows = db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY ${orderBy}`).all(req.userId);
    res.json(rows);
  });

  router.post('/', (req: AuthRequest, res: Response) => {
    const body = req.body ?? {};
    const nombre = normalize(body.nombre);
    if (!nombre) { res.status(400).json({ error: required }); return; }
    const cols = ['user_id', 'nombre', ...extraCols];
    const values = [req.userId, nombre, ...extraCols.map((c) => body[c] ?? '')];
    try {
      const placeholders = cols.map(() => '?').join(', ');
      const result = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid) as any;
      res.status(201).json(row);
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: conflict }); return; }
      res.status(500).json({ error: createError });
    }
  });

  // PUT /:id/default → guarda el default del usuario en `config`.
  if (opts.defaultKey) {
    router.put('/:id/default', (req: AuthRequest, res: Response) => {
      const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.userId) as any;
      if (!existing) { res.status(404).json({ error: notFound }); return; }
      const value = opts.defaultOf === 'nombre' ? existing.nombre : String(existing.id);
      db.prepare(
        `INSERT INTO config (user_id, clave, valor) VALUES (?, ?, ?)
         ON CONFLICT(user_id, clave) DO UPDATE SET valor = excluded.valor`
      ).run(req.userId, opts.defaultKey, value);
      res.json({ ok: true });
    });
  }

  router.put('/:id', (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const body = req.body ?? {};
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, userId) as any;
    if (!existing) { res.status(404).json({ error: notFound }); return; }

    const hasNombre = body.nombre !== undefined;
    // Categorías/idiomas exigen `nombre` en PUT; tags lo permiten opcional (solo color).
    if ((opts.requireNombreOnUpdate ?? true) && !hasNombre) { res.status(400).json({ error: required }); return; }
    const rawNombre = hasNombre ? String(body.nombre) : String(existing.nombre);
    const newNombre = normalize(rawNombre);
    if (hasNombre && !newNombre) { res.status(400).json({ error: required }); return; }

    const setCols = ['nombre = ?'];
    const setValues: any[] = [newNombre];
    for (const c of extraCols) {
      if (body[c] !== undefined) { setCols.push(`${c} = ?`); setValues.push(body[c]); }
    }
    const renamed = hasNombre && String(newNombre) !== String(existing.nombre);

    let affectedPostulaciones = 0;
    try {
      const apply = () =>
        db.prepare(`UPDATE ${table} SET ${setCols.join(', ')} WHERE id = ? AND user_id = ?`).run(...setValues, req.params.id, userId);

      if (opts.propagateOnRename && renamed && body.propagate === true) {
        db.transaction(() => {
          apply();
          affectedPostulaciones = db.prepare(
            `UPDATE ${opts.propagateOnRename!.table} SET ${opts.propagateOnRename!.column} = ?
             WHERE ${opts.propagateOnRename!.column} = ? AND user_id = ?`
          ).run(newNombre, existing.nombre, userId).changes;
        })();
      } else {
        apply();
      }

      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id) as any;
      res.json(opts.propagateOnRename ? { ...row, affectedPostulaciones } : row);
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: conflict }); return; }
      res.status(500).json({ error: updateError });
    }
  });

  router.delete('/:id', (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    if (opts.reassignOnDelete && req.body?.dest !== undefined) {
      const reassignErrors = opts.reassignErrors ?? {
        destNotFound: 'Etiqueta destino no encontrada',
        same: 'No se puede reasignar a la misma etiqueta',
      };
      const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, userId) as any;
      if (!existing) { res.status(404).json({ error: notFound }); return; }
      const destRow = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.body.dest, userId) as any;
      if (!destRow) { res.status(400).json({ error: reassignErrors.destNotFound }); return; }
      if (Number(req.body.dest) === Number(req.params.id)) { res.status(400).json({ error: reassignErrors.same }); return; }
      const refBy = opts.reassignRefKind === 'id';
      const srcRef = refBy ? existing.id : existing.nombre;
      const destRef = refBy ? destRow.id : destRow.nombre;
      const affected = db.transaction(() => {
        const { table: refTable, column: refCol } = opts.reassignOnDelete!;
        const changes = db.prepare(
          `UPDATE ${refTable} SET ${refCol} = ? WHERE ${refCol} = ? AND user_id = ?`
        ).run(destRef, srcRef, userId).changes;
        db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
        return changes;
      })();
      res.json({ ok: true, affectedPostulaciones: affected });
      return;
    }

    const result = db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
    if ((opts.notFoundOnDelete ?? true) && result.changes === 0) { res.status(404).json({ error: notFound }); return; }
    res.json({ ok: true });
  });

  return router;
}