import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM categorias WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json(rows);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre es requerido' });
    return;
  }
  try {
    const stmt = db.prepare('INSERT INTO categorias (user_id, nombre) VALUES (?, ?)');
    const result = stmt.run(req.userId, nombre.trim());
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

router.put('/:id/default', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categorias WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }
  db.prepare(`
    INSERT INTO config (user_id, clave, valor) VALUES (?, 'default_categoria_id', ?)
    ON CONFLICT(user_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(req.userId, id);
  res.json({ ok: true });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const existing = db.prepare('SELECT * FROM categorias WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return; }
  try {
    db.prepare('UPDATE categorias SET nombre = ? WHERE id = ? AND user_id = ?').run(nombre.trim(), id, req.userId);
    const row = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
    res.json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe una categoría con ese nombre' }); return; }
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM categorias WHERE id = ? AND user_id = ?');
  const result = stmt.run(id, req.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Categoría no encontrada' });
    return;
  }
  res.json({ ok: true });
});

export default router;
