import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
}

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM tags ORDER BY id ASC').all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const { nombre, color } = req.body;
  const n = nombre ? slugify(nombre) : '';
  if (!n) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  try {
    const result = db.prepare('INSERT INTO tags (nombre, color) VALUES (?, ?)').run(n, color || '');
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe ese tag' }); return; }
    res.status(500).json({ error: 'Error al crear tag' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const { nombre, color, propagate } = req.body;
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Tag no encontrado' }); return; }

  if (nombre !== undefined && !slugify(nombre)) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const newNombre = nombre !== undefined ? slugify(nombre) : existing.nombre;
  const newColor = color !== undefined ? color : existing.color;
  const renamed = newNombre !== existing.nombre;

  try {
    let affectedPostulaciones = 0;
    if (renamed && propagate === true) {
      db.transaction(() => {
        db.prepare('UPDATE tags SET nombre = ?, color = ? WHERE id = ?').run(newNombre, newColor, req.params.id);
        affectedPostulaciones = db.prepare('UPDATE postulaciones SET estado = ? WHERE estado = ?').run(newNombre, existing.nombre).changes;
      })();
    } else {
      db.prepare('UPDATE tags SET nombre = ?, color = ? WHERE id = ?').run(newNombre, newColor, req.params.id);
    }
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id) as any;
    res.json({ ...row, affectedPostulaciones });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe un tag con ese nombre' }); return; }
    res.status(500).json({ error: 'Error al actualizar tag' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: 'Tag no encontrado' }); return; }

  const dest = req.body?.dest;
  if (dest !== undefined) {
    const destTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(dest) as any;
    if (!destTag) { res.status(400).json({ error: 'Etiqueta destino no encontrada' }); return; }
    if (Number(dest) === Number(req.params.id)) { res.status(400).json({ error: 'No se puede reasignar a la misma etiqueta' }); return; }
    const affected = db.transaction(() => {
      const changes = db.prepare('UPDATE postulaciones SET estado = ? WHERE estado = ?').run(destTag.nombre, existing.nombre).changes;
      db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
      return changes;
    })();
    res.json({ ok: true, affectedPostulaciones: affected });
    return;
  }

  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
