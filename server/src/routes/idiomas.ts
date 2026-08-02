import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM idiomas ORDER BY created_at ASC').all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  try {
    const result = db.prepare('INSERT INTO idiomas (nombre) VALUES (?)').run(nombre.trim());
    const row = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe ese idioma' }); return; }
    res.status(500).json({ error: 'Error al crear idioma' });
  }
});

router.put('/:id/default', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  db.prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES ('default_idioma', ?)").run((existing as any).nombre);
  res.json({ ok: true });
});

router.put('/:id', (req: Request, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const existing = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  try {
    db.prepare('UPDATE idiomas SET nombre = ? WHERE id = ?').run(nombre.trim(), req.params.id);
    const row = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe ese idioma' }); return; }
    res.status(500).json({ error: 'Error al actualizar idioma' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM idiomas WHERE id = ?').run(req.params.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
