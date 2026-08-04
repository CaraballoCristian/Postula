import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function categoriaDelUsuario(categoria_id: number, userId: number): boolean {
  return !!db.prepare('SELECT id FROM categorias WHERE id = ? AND user_id = ?').get(categoria_id, userId);
}

router.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { categoria_id, idioma, tipo } = req.query;
  let sql = 'SELECT * FROM templates WHERE user_id = ?';
  const params: any[] = [userId];

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

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }
  res.json(row);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { categoria_id, idioma, tipo, nombre, contenido } = req.body;
  if (!categoria_id || !idioma || !tipo || !nombre || contenido === undefined) {
    res.status(400).json({ error: 'Todos los campos son requeridos' });
    return;
  }
  if (!categoriaDelUsuario(Number(categoria_id), req.userId!)) {
    res.status(400).json({ error: 'Categoría no encontrada' });
    return;
  }

  const stmt = db.prepare(
    'INSERT INTO templates (user_id, categoria_id, idioma, tipo, nombre, contenido) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(req.userId, categoria_id, idioma, tipo, nombre.trim(), contenido);
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre, contenido, categoria_id, idioma, tipo } = req.body;

  const existing = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }
  if (categoria_id !== undefined && !categoriaDelUsuario(Number(categoria_id), req.userId!)) {
    res.status(400).json({ error: 'Categoría no encontrada' });
    return;
  }

  const newNombre = nombre !== undefined ? nombre.trim() : existing.nombre;
  const newContenido = contenido !== undefined ? contenido : existing.contenido;
  const newCat = categoria_id !== undefined ? categoria_id : existing.categoria_id;
  const newLang = idioma !== undefined ? idioma : existing.idioma;
  const newTipo = tipo !== undefined ? tipo : existing.tipo;

  db.prepare(
    `UPDATE templates SET nombre = ?, contenido = ?, categoria_id = ?, idioma = ?, tipo = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(newNombre, newContenido, newCat, newLang, newTipo, id, req.userId);

  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const stmt = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?');
  const result = stmt.run(req.params.id, req.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Template no encontrado' });
    return;
  }
  res.json({ ok: true });
});

export default router;
