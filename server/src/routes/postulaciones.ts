import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function parseRow(r: any) {
  return {
    ...r,
    template_ids: JSON.parse(r.template_ids || '[]'),
    valores_usados: JSON.parse(r.valores_usados || '{}'),
  };
}

function categoriaDelUsuario(categoria_id: number, userId: number): boolean {
  return !!db.prepare('SELECT id FROM categorias WHERE id = ? AND user_id = ?').get(categoria_id, userId);
}

router.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { empresa, categoria_id, trashed } = req.query;
  let sql = 'SELECT * FROM postulaciones WHERE user_id = ?';
  const params: any[] = [userId];

  // Papelera: excluir borradas por defecto; `?trashed=1` devuelve solo borradas.
  if (trashed === '1') {
    sql += ' AND deleted_at IS NOT NULL';
  } else {
    sql += ' AND deleted_at IS NULL';
  }

  if (empresa) {
    sql += ' AND empresa LIKE ?';
    params.push(`%${empresa}%`);
  }
  if (categoria_id) {
    sql += ' AND categoria_id = ?';
    params.push(Number(categoria_id));
  }

  sql += ' ORDER BY fecha DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(parseRow));
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!row) {
    res.status(404).json({ error: 'Postulación no encontrada' });
    return;
  }
  res.json(parseRow(row));
});

router.post('/', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const {
    empresa,
    oferta_laboral,
    categoria_id,
    idioma,
    nombre_empleado,
    puesto_empleado,
    template_ids,
    valores_usados,
    resultado_email,
    resultado_empresa,
    resultado_recruiter,
    notas,
    estado,
    link_empresa,
    contacto_empleado,
    favorito,
  } = req.body;

  if (categoria_id != null && !categoriaDelUsuario(Number(categoria_id), userId)) {
    res.status(400).json({ error: 'Categoría no encontrada' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO postulaciones (user_id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
      template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter,
      notas, estado, link_empresa, contacto_empleado, favorito)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    userId,
    empresa || '',
    oferta_laboral || '',
    categoria_id || null,
    idioma || null,
    nombre_empleado || '',
    puesto_empleado || '',
    JSON.stringify(template_ids || []),
    JSON.stringify(valores_usados || {}),
    resultado_email || null,
    resultado_empresa || null,
    resultado_recruiter || null,
    notas || '',
    estado || 'solicitado',
    link_empresa || '',
    contacto_empleado || '',
    favorito || 0,
  );

  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json(parseRow(row));
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const existing = db.prepare('SELECT * FROM postulaciones WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Postulación no encontrada' }); return; }

  const {
    empresa, oferta_laboral, categoria_id, idioma,
    nombre_empleado, puesto_empleado, estado,
    notas, link_empresa, contacto_empleado, favorito,
  } = req.body;

  if (categoria_id != null && !categoriaDelUsuario(Number(categoria_id), userId)) {
    res.status(400).json({ error: 'Categoría no encontrada' });
    return;
  }

  db.prepare(`
    UPDATE postulaciones SET
      empresa = COALESCE(?, empresa),
      oferta_laboral = COALESCE(?, oferta_laboral),
      categoria_id = COALESCE(?, categoria_id),
      idioma = COALESCE(?, idioma),
      nombre_empleado = COALESCE(?, nombre_empleado),
      puesto_empleado = COALESCE(?, puesto_empleado),
      estado = COALESCE(?, estado),
      notas = COALESCE(?, notas),
      link_empresa = COALESCE(?, link_empresa),
      contacto_empleado = COALESCE(?, contacto_empleado),
      favorito = COALESCE(?, favorito)
    WHERE id = ? AND user_id = ?
  `).run(
    empresa !== undefined ? empresa : null,
    oferta_laboral !== undefined ? oferta_laboral : null,
    categoria_id !== undefined ? categoria_id : null,
    idioma !== undefined ? idioma : null,
    nombre_empleado !== undefined ? nombre_empleado : null,
    puesto_empleado !== undefined ? puesto_empleado : null,
    estado !== undefined ? estado : null,
    notas !== undefined ? notas : null,
    link_empresa !== undefined ? link_empresa : null,
    contacto_empleado !== undefined ? contacto_empleado : null,
    favorito !== undefined ? favorito : null,
    id,
    userId,
  );

  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id) as any;
  res.json(parseRow(row));
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const existing = db.prepare('SELECT * FROM postulaciones WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!existing) { res.status(404).json({ error: 'Postulación no encontrada' }); return; }

  const mode = req.query.mode === 'hard' ? 'hard' : 'soft';
  if (mode === 'hard') {
    db.prepare('DELETE FROM postulaciones WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ ok: true, mode: 'hard' });
    return;
  }
  // soft: mover a la papelera
  db.prepare("UPDATE postulaciones SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?").run(id, userId);
  res.json({ ok: true, mode: 'soft' });
});

// Restaurar desde la papelera
router.post('/:id/restore', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM postulaciones WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!existing) { res.status(404).json({ error: 'Postulación no encontrada' }); return; }
  db.prepare('UPDATE postulaciones SET deleted_at = NULL WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(req.params.id) as any;
  res.json(parseRow(row));
});

export default router;
