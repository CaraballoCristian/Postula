import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT e.id, e.nombre, e.link, e.created_at,
      (SELECT COUNT(*) FROM postulaciones p
        WHERE p.user_id = e.user_id AND p.empresa = e.nombre AND p.deleted_at IS NULL) AS post_count,
      (SELECT COUNT(*) FROM postulaciones p
        WHERE p.user_id = e.user_id AND p.empresa = e.nombre AND p.deleted_at IS NULL AND p.favorito = 1) AS favorita_count
    FROM empresas e
    WHERE e.user_id = ?
    ORDER BY e.nombre COLLATE NOCASE ASC
  `).all(req.userId);
  res.json(rows);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { nombre, link } = req.body;
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
  const l = typeof link === 'string' ? link.trim() : '';
  const exists = db.prepare('SELECT id FROM empresas WHERE user_id = ? AND lower(nombre) = lower(?)').get(req.userId, n);
  if (exists) { res.status(409).json({ error: 'EMPRESA_EXISTE', message: 'Ya existe esa empresa' }); return; }
  try {
    const result = db.prepare('INSERT INTO empresas (user_id, nombre, link) VALUES (?, ?, ?)').run(req.userId, n, l);
    const row = db.prepare('SELECT * FROM empresas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'EMPRESA_EXISTE', message: 'Ya existe esa empresa' }); return; }
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const existing = db.prepare('SELECT * FROM empresas WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;
  if (!existing) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  const { nombre, link } = req.body;
  const newNombre = typeof nombre === 'string' && nombre.trim() ? nombre.trim() : existing.nombre;
  const newLink = typeof link === 'string' ? link.trim() : existing.link;
  const renamed = newNombre !== existing.nombre;

  try {
    let affectedPostulaciones = 0;
    db.transaction(() => {
      db.prepare('UPDATE empresas SET nombre = ?, link = ? WHERE id = ? AND user_id = ?').run(newNombre, newLink, req.params.id, userId);
      if (renamed) {
        db.prepare('UPDATE postulaciones SET empresa = ? WHERE empresa = ? AND user_id = ?').run(newNombre, existing.nombre, userId);
      }
      affectedPostulaciones = db.prepare('UPDATE postulaciones SET link_empresa = ? WHERE empresa = ? AND user_id = ?').run(newLink, newNombre, userId).changes;
    })();
    const row = db.prepare('SELECT * FROM empresas WHERE id = ?').get(req.params.id) as any;
    res.json({ ...row, affectedPostulaciones });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) { res.status(409).json({ error: 'EMPRESA_EXISTE', message: 'Ya existe una empresa con ese nombre' }); return; }
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const existing = db.prepare('SELECT * FROM empresas WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;
  if (!existing) { res.status(404).json({ error: 'Empresa no encontrada' }); return; }

  const affected = db.transaction(() => {
    const changes = db.prepare("UPDATE postulaciones SET deleted_at = datetime('now') WHERE user_id = ? AND empresa = ? AND deleted_at IS NULL")
      .run(userId, existing.nombre).changes;
    db.prepare('DELETE FROM empresas WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    return changes;
  })();
  res.json({ ok: true, affectedPostulaciones: affected });
});

export default router;
