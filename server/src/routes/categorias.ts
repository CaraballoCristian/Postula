import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM categorias ORDER BY created_at ASC').all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre es requerido' });
    return;
  }
  try {
    const stmt = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
    const result = stmt.run(nombre.trim());
    const row = db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      return;
    }
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM categorias WHERE id = ?');
  const result = stmt.run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Categoría no encontrada' });
    return;
  }
  res.json({ ok: true });
});

export default router;
