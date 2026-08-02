import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { empresa, categoria_id } = req.query;
  let sql = 'SELECT * FROM postulaciones WHERE 1=1';
  const params: any[] = [];

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

  const parsed = rows.map((r: any) => ({
    ...r,
    template_ids: JSON.parse(r.template_ids || '[]'),
    valores_usados: JSON.parse(r.valores_usados || '{}'),
  }));

  res.json(parsed);
});

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: 'Postulación no encontrada' });
    return;
  }
  res.json({
    ...row,
    template_ids: JSON.parse(row.template_ids || '[]'),
    valores_usados: JSON.parse(row.valores_usados || '{}'),
  });
});

router.post('/', (req: Request, res: Response) => {
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

  const stmt = db.prepare(`
    INSERT INTO postulaciones (empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
      template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter,
      notas, estado, link_empresa, contacto_empleado, favorito)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
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
  res.status(201).json({
    ...row,
    template_ids: JSON.parse(row.template_ids || '[]'),
    valores_usados: JSON.parse(row.valores_usados || '{}'),
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Postulación no encontrada' }); return; }

  const {
    empresa, oferta_laboral, categoria_id, idioma,
    nombre_empleado, puesto_empleado, estado,
    notas, link_empresa, contacto_empleado, favorito,
  } = req.body;

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
    WHERE id = ?
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
  );

  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id) as any;
  res.json({
    ...row,
    template_ids: JSON.parse(row.template_ids || '[]'),
    valores_usados: JSON.parse(row.valores_usados || '{}'),
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const stmt = db.prepare('DELETE FROM postulaciones WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Postulación no encontrada' });
    return;
  }
  res.json({ ok: true });
});

export default router;
