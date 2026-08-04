import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const RESERVED_KEYS = ['default_categoria_id', 'default_idioma'];

function isReserved(clave: string): boolean {
  return RESERVED_KEYS.includes(clave) || /^default_/.test(clave);
}

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM config WHERE user_id = ? ORDER BY id ASC').all(req.userId);
  res.json(rows);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { clave, valor } = req.body;
  if (!clave || !clave.trim()) {
    res.status(400).json({ error: 'La clave es requerida' });
    return;
  }
  if (isReserved(clave.trim())) {
    res.status(400).json({ error: 'RESERVED_CONFIG_KEY' });
    return;
  }
  try {
    const stmt = db.prepare('INSERT INTO config (user_id, clave, valor) VALUES (?, ?, ?)');
    const result = stmt.run(req.userId, clave.trim(), valor ?? '');
    const row = db.prepare('SELECT * FROM config WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Ya existe una clave con ese nombre' });
      return;
    }
    res.status(500).json({ error: 'Error al crear configuración' });
  }
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { clave, valor } = req.body;

  const existing = db.prepare('SELECT * FROM config WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Configuración no encontrada' });
    return;
  }

  const newClave = clave !== undefined ? clave.trim() : existing.clave;
  const newValor = valor !== undefined ? valor : existing.valor;

  if (isReserved(newClave)) {
    res.status(400).json({ error: 'RESERVED_CONFIG_KEY' });
    return;
  }

  try {
    db.prepare('UPDATE config SET clave = ?, valor = ? WHERE id = ? AND user_id = ?').run(newClave, newValor, id, req.userId);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Ya existe una clave con ese nombre' });
      return;
    }
    throw e;
  }

  const row = db.prepare('SELECT * FROM config WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM config WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Configuración no encontrada' });
    return;
  }
  if (isReserved(existing.clave)) {
    res.status(400).json({ error: 'RESERVED_CONFIG_KEY' });
    return;
  }
  db.prepare('DELETE FROM config WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

export default router;
