import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { categoria_id, idioma, tipo } = req.query;
  let sql = 'SELECT * FROM templates WHERE 1=1';
  const params: any[] = [];

  if (categoria_id) {
    sql += ' AND categoria_id = ?';
    params.push(Number(categoria_id));
  }
  if (idioma) {
    sql += ' AND idioma = ?';
    params.push(idioma);
  }
  if (tipo) {
    sql += ' AND tipo = ?';
    params.push(tipo);
  }

  sql += ' ORDER BY orden ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }
  res.json(row);
});

router.post('/', (req: Request, res: Response) => {
  const { categoria_id, idioma, tipo, nombre, contenido } = req.body;
  if (!categoria_id || !idioma || !tipo || !nombre || contenido === undefined) {
    res.status(400).json({ error: 'Todos los campos son requeridos' });
    return;
  }

  const maxOrden = db.prepare(
    'SELECT COALESCE(MAX(orden), 0) as max_orden FROM templates WHERE categoria_id = ? AND idioma = ? AND tipo = ?'
  ).get(categoria_id, idioma, tipo) as { max_orden: number };

  const newOrden = maxOrden.max_orden + 1;

  const stmt = db.prepare(
    'INSERT INTO templates (categoria_id, idioma, tipo, nombre, contenido, orden) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(categoria_id, idioma, tipo, nombre.trim(), contenido, newOrden);
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, contenido, categoria_id, idioma, tipo } = req.body;

  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }

  const newNombre = nombre !== undefined ? nombre.trim() : existing.nombre;
  const newContenido = contenido !== undefined ? contenido : existing.contenido;
  const newCat = categoria_id !== undefined ? categoria_id : existing.categoria_id;
  const newLang = idioma !== undefined ? idioma : existing.idioma;
  const newTipo = tipo !== undefined ? tipo : existing.tipo;

  db.prepare(
    `UPDATE templates SET nombre = ?, contenido = ?, categoria_id = ?, idioma = ?, tipo = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(newNombre, newContenido, newCat, newLang, newTipo, id);

  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  res.json(row);
});

router.patch('/:id/reorder', (req: Request, res: Response) => {
  const { id } = req.params;
  const { new_orden } = req.body;

  if (typeof new_orden !== 'number') {
    res.status(400).json({ error: 'new_orden (number) es requerido' });
    return;
  }

  const target = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  if (!target) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }

  const group = db.prepare(
    'SELECT * FROM templates WHERE categoria_id = ? AND idioma = ? AND tipo = ? ORDER BY orden ASC'
  ).all(target.categoria_id, target.idioma, target.tipo) as any[];

  const currentIndex = group.findIndex((t: any) => t.id === Number(id));
  if (currentIndex === -1) {
    res.status(500).json({ error: 'Error interno' });
    return;
  }

  const [moved] = group.splice(currentIndex, 1);
  const clampedIndex = Math.max(0, Math.min(new_orden, group.length));
  group.splice(clampedIndex, 0, moved);

  const updateStmt = db.prepare('UPDATE templates SET orden = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    group.forEach((t: any, i: number) => {
      updateStmt.run(i + 1, t.id);
    });
  });
  reorder();

  const rows = db.prepare(
    'SELECT * FROM templates WHERE categoria_id = ? AND idioma = ? AND tipo = ? ORDER BY orden ASC'
  ).all(target.categoria_id, target.idioma, target.tipo);

  res.json(rows);
});

router.delete('/:id', (req: Request, res: Response) => {
  const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }
  res.json({ ok: true });
});

export default router;
