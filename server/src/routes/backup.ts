import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

const TABLES = ['categorias', 'templates', 'config', 'idiomas', 'tags', 'postulaciones'] as const;

// Export: snapshot completo de la base en JSON.
router.get('/export', (_req: Request, res: Response) => {
  const data: Record<string, any[]> = {
    categorias: db.prepare('SELECT * FROM categorias ORDER BY id').all(),
    templates: db.prepare('SELECT * FROM templates ORDER BY id').all(),
    config: db.prepare('SELECT * FROM config ORDER BY id').all(),
    postulaciones: db.prepare('SELECT * FROM postulaciones ORDER BY id').all().map((r: any) => ({
      ...r,
      template_ids: JSON.parse(r.template_ids || '[]'),
      valores_usados: JSON.parse(r.valores_usados || '{}'),
    })),
    idiomas: db.prepare('SELECT * FROM idiomas ORDER BY id').all(),
    tags: db.prepare('SELECT * FROM tags ORDER BY id').all(),
  };
  res.header('Content-Disposition', `attachment; filename="postulatool-backup-${Date.now()}.json"`);
  res.json({ version: db.pragma('user_version', { simple: true }), exported_at: new Date().toISOString(), ...data });
});

// Importa/restaura: merge por ID con dedup de exactos (no reemplaza).
router.post('/import', (req: Request, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }

  const merge = db.transaction(() => {
    db.pragma('foreign_keys = OFF');

    let skipped = 0;

    // Categorías: dedup por nombre, upsert por ID
    const dupCat = db.prepare('SELECT id FROM categorias WHERE nombre = ?');
    const upsertCat = db.prepare(`INSERT INTO categorias (id, nombre, created_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, created_at=excluded.created_at`);
    for (const c of data.categorias ?? []) {
      const dup = dupCat.get(c.nombre);
      if (dup && (dup as any).id !== c.id) { skipped++; continue; }
      upsertCat.run(c.id, c.nombre, c.created_at || new Date().toISOString());
    }

    // Templates: dedup por (categoria_id, idioma, tipo, nombre, contenido, orden)
    const dupTpl = db.prepare('SELECT id FROM templates WHERE categoria_id = ? AND idioma = ? AND tipo = ? AND nombre = ? AND contenido = ? AND orden = ?');
    const upsertTpl = db.prepare(`INSERT INTO templates (id, categoria_id, idioma, tipo, nombre, contenido, orden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET categoria_id=excluded.categoria_id, idioma=excluded.idioma, tipo=excluded.tipo,
        nombre=excluded.nombre, contenido=excluded.contenido, orden=excluded.orden, created_at=excluded.created_at, updated_at=excluded.updated_at`);
    for (const t of data.templates ?? []) {
      const dup = dupTpl.get(t.categoria_id, t.idioma, t.tipo, t.nombre, t.contenido, t.orden ?? 0);
      if (dup && (dup as any).id !== t.id) { skipped++; continue; }
      upsertTpl.run(t.id, t.categoria_id, t.idioma, t.tipo, t.nombre, t.contenido, t.orden ?? 0, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString());
    }

    // Config: dedup por (clave, valor)
    const dupCfg = db.prepare('SELECT id FROM config WHERE clave = ? AND valor = ?');
    const upsertCfg = db.prepare(`INSERT INTO config (id, clave, valor) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET clave=excluded.clave, valor=excluded.valor`);
    for (const c of data.config ?? []) {
      const dup = dupCfg.get(c.clave, c.valor ?? '');
      if (dup && (dup as any).id !== c.id) { skipped++; continue; }
      upsertCfg.run(c.id, c.clave, c.valor ?? '');
    }

    // Tags: dedup por (nombre, color)
    const dupTag = db.prepare('SELECT id FROM tags WHERE nombre = ? AND color = ?');
    const upsertTag = db.prepare(`INSERT INTO tags (id, nombre, color, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, color=excluded.color, created_at=excluded.created_at`);
    for (const t of data.tags ?? []) {
      const dup = dupTag.get(t.nombre, t.color ?? '');
      if (dup && (dup as any).id !== t.id) { skipped++; continue; }
      upsertTag.run(t.id, t.nombre, t.color ?? '', t.created_at || new Date().toISOString());
    }

    // Idiomas: dedup por nombre
    const dupIdiom = db.prepare('SELECT id FROM idiomas WHERE nombre = ?');
    const upsertIdiom = db.prepare(`INSERT INTO idiomas (id, nombre, created_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, created_at=excluded.created_at`);
    for (const i of data.idiomas ?? []) {
      const dup = dupIdiom.get(i.nombre);
      if (dup && (dup as any).id !== i.id) { skipped++; continue; }
      upsertIdiom.run(i.id, i.nombre, i.created_at || new Date().toISOString());
    }

    // Postulaciones: dedup por todos los campos significativos (excluye id, created_at)
    // Usa COALESCE para manejar NULLs correctamente (NULL = NULL → true con COALESCE).
    const dupPost = db.prepare(`SELECT id FROM postulaciones WHERE
      empresa = ? AND oferta_laboral = ? AND COALESCE(categoria_id, -1) = COALESCE(?, -1) AND COALESCE(idioma, '') = COALESCE(?, '') AND
      nombre_empleado = ? AND puesto_empleado = ? AND template_ids = ? AND valores_usados = ? AND
      COALESCE(resultado_email, '') = COALESCE(?, '') AND COALESCE(resultado_empresa, '') = COALESCE(?, '') AND COALESCE(resultado_recruiter, '') = COALESCE(?, '') AND
      notas = ? AND estado = ? AND link_empresa = ? AND contacto_empleado = ? AND
      favorito = ? AND COALESCE(deleted_at, '') = COALESCE(?, '') AND fecha = ?`);
    const upsertPost = db.prepare(`INSERT INTO postulaciones
      (id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
        template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado,
        link_empresa, contacto_empleado, favorito, deleted_at, fecha, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        empresa=excluded.empresa, oferta_laboral=excluded.oferta_laboral, categoria_id=excluded.categoria_id,
        idioma=excluded.idioma, nombre_empleado=excluded.nombre_empleado, puesto_empleado=excluded.puesto_empleado,
        template_ids=excluded.template_ids, valores_usados=excluded.valores_usados,
        resultado_email=excluded.resultado_email, resultado_empresa=excluded.resultado_empresa,
        resultado_recruiter=excluded.resultado_recruiter, notas=excluded.notas, estado=excluded.estado,
        link_empresa=excluded.link_empresa, contacto_empleado=excluded.contacto_empleado,
        favorito=excluded.favorito, deleted_at=excluded.deleted_at, fecha=excluded.fecha, created_at=excluded.created_at`);
    for (const p of (data.postulaciones ?? []) as any[]) {
      const tid = JSON.stringify(p.template_ids || []);
      const vals = JSON.stringify(p.valores_usados || {});
      const dup = dupPost.get(
        p.empresa, p.oferta_laboral || '', p.categoria_id ?? null, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', tid, vals,
        p.resultado_email ?? null, p.resultado_empresa ?? null, p.resultado_recruiter ?? null,
        p.notas || '', p.estado || 'solicitado', p.link_empresa || '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, p.fecha || new Date().toISOString(),
      );
      if (dup && (dup as any).id !== p.id) { skipped++; continue; }
      upsertPost.run(
        p.id, p.empresa, p.oferta_laboral || '', p.categoria_id ?? null, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', tid, vals,
        p.resultado_email ?? null, p.resultado_empresa ?? null, p.resultado_recruiter ?? null,
        p.notas || '', p.estado || 'solicitado', p.link_empresa || '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, p.fecha || new Date().toISOString(), p.created_at || new Date().toISOString(),
      );
    }

    // Reiniciar secuencias de autoincrement a lo máximo insertado.
    for (const [t, col] of ([['categorias', 'id'], ['templates', 'id'], ['config', 'id'], ['tags', 'id'], ['idiomas', 'id'], ['postulaciones', 'id']] as [string, string][])) {
      const mx = db.prepare(`SELECT MAX(${col}) as m FROM ${t}`).get() as any;
      if (mx?.m != null) db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`).run(mx.m, t);
    }
    db.pragma('foreign_keys = ON');
    return { skipped };
  });

  try {
    const result = merge();
    res.json({ ok: true, skipped: result?.skipped ?? 0, counts: Object.fromEntries(TABLES.map(t => [t, (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as any).c])) });
  } catch (e: any) {
    db.pragma('foreign_keys = ON');
    res.status(500).json({ error: 'Error al importar el backup: ' + e.message });
  }
});

export default router;