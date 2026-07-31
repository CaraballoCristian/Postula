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
    puesto_oferta,
    categoria_id,
    idioma,
    nombre_reclutador,
    puesto_reclutador,
    template_ids,
    valores_usados,
    resultado_email,
    resultado_empresa,
    resultado_recruiter,
  } = req.body;

  if (!empresa) {
    res.status(400).json({ error: 'El campo empresa es requerido' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO postulaciones (empresa, puesto_oferta, categoria_id, idioma, nombre_reclutador, puesto_reclutador,
      template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    empresa,
    puesto_oferta || '',
    categoria_id || null,
    idioma || null,
    nombre_reclutador || '',
    puesto_reclutador || '',
    JSON.stringify(template_ids || []),
    JSON.stringify(valores_usados || {}),
    resultado_email || null,
    resultado_empresa || null,
    resultado_recruiter || null,
  );

  const row = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json({
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
