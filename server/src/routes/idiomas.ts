import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM idiomas WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json(rows);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  try {
    const result = db.prepare('INSERT INTO idiomas (user_id, nombre) VALUES (?, ?)').run(req.userId, nombre.trim());
    const row = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe ese idioma' }); return; }
    res.status(500).json({ error: 'Error al crear idioma' });
  }
});

router.put('/:id/default', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM idiomas WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  db.prepare(`
    INSERT INTO config (user_id, clave, valor) VALUES (?, 'default_idioma', ?)
    ON CONFLICT(user_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(req.userId, (existing as any).nombre);
  res.json({ ok: true });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const existing = db.prepare('SELECT * FROM idiomas WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  try {
    db.prepare('UPDATE idiomas SET nombre = ? WHERE id = ? AND user_id = ?').run(nombre.trim(), req.params.id, req.userId);
    const row = db.prepare('SELECT * FROM idiomas WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'Ya existe ese idioma' }); return; }
    res.status(500).json({ error: 'Error al actualizar idioma' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const result = db.prepare('DELETE FROM idiomas WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Idioma no encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
