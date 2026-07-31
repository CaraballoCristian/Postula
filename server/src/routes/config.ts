import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM config ORDER BY id ASC').all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const { clave, valor } = req.body;
  if (!clave || !clave.trim()) {
    res.status(400).json({ error: 'La clave es requerida' });
    return;
  }
  try {
    const stmt = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)');
    const result = stmt.run(clave.trim(), valor ?? '');
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

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clave, valor } = req.body;

  const existing = db.prepare('SELECT * FROM config WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Configuración no encontrada' });
    return;
  }

  const newClave = clave !== undefined ? clave.trim() : existing.clave;
  const newValor = valor !== undefined ? valor : existing.valor;

  try {
    db.prepare('UPDATE config SET clave = ?, valor = ? WHERE id = ?').run(newClave, newValor, id);
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

router.delete('/:id', (req: Request, res: Response) => {
  const stmt = db.prepare('DELETE FROM config WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Configuración no encontrada' });
    return;
  }
  res.json({ ok: true });
});

export default router;
