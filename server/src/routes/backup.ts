import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const TABLES = ['categorias', 'templates', 'config', 'idiomas', 'tags', 'postulaciones'] as const;

// Export: snapshot del usuario en JSON (sin columna user_id, es interna).
router.get('/export', (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const strip = (rows: any[]) => rows.map(({ user_id, ...rest }: any) => rest);

  const data: Record<string, any[]> = {
    categorias: strip(db.prepare('SELECT * FROM categorias WHERE user_id = ? ORDER BY id').all(userId)),
    templates: strip(db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY id').all(userId)),
    config: strip(db.prepare('SELECT * FROM config WHERE user_id = ? ORDER BY id').all(userId)),
    postulaciones: strip(
      db.prepare('SELECT * FROM postulaciones WHERE user_id = ? ORDER BY id').all(userId).map((r: any) => ({
        ...r,
        template_ids: JSON.parse(r.template_ids || '[]'),
        valores_usados: JSON.parse(r.valores_usados || '{}'),
      }))
    ),
    idiomas: strip(db.prepare('SELECT * FROM idiomas WHERE user_id = ? ORDER BY id').all(userId)),
    tags: strip(db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY id').all(userId)),
  };
  res.header('Content-Disposition', `attachment; filename="postulatool-backup-${Date.now()}.json"`);
  res.json({ version: db.pragma('user_version', { simple: true }), exported_at: new Date().toISOString(), ...data });
});

// Importa/restaura: merge por ID con dedup de exactos (no reemplaza).
router.post('/import', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const userId = req.userId!;

  const merge = db.transaction(() => {
    let skipped = 0;

    // Helper de ownership: una fila cuyo id ya exista y pertenezca a OTRO usuario
    // jamás se toca (ni se pisa ni se reasigna).
    const ownerCat = db.prepare('SELECT user_id FROM categorias WHERE id = ?');
    const ownerTpl = db.prepare('SELECT user_id FROM templates WHERE id = ?');
    const ownerCfg = db.prepare('SELECT user_id FROM config WHERE id = ?');
    const ownerTag = db.prepare('SELECT user_id FROM tags WHERE id = ?');
    const ownerIdiom = db.prepare('SELECT user_id FROM idiomas WHERE id = ?');
    const ownerPost = db.prepare('SELECT user_id FROM postulaciones WHERE id = ?');

    // Categorías: dedup por nombre (del usuario), upsert por ID
    const dupCat = db.prepare('SELECT id FROM categorias WHERE user_id = ? AND nombre = ?');
    const upsertCat = db.prepare(`INSERT INTO categorias (id, user_id, nombre, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, user_id=excluded.user_id, created_at=excluded.created_at
      WHERE categorias.user_id = excluded.user_id`);
    for (const c of data.categorias ?? []) {
      const owner = ownerCat.get(c.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const dup = dupCat.get(userId, c.nombre);
      if (dup && (dup as any).id !== c.id) { skipped++; continue; }
      upsertCat.run(c.id, userId, c.nombre, c.created_at || new Date().toISOString());
    }

    // Templates: dedup por (categoria_id, idioma, tipo, nombre, contenido, orden)
    const dupTpl = db.prepare('SELECT id FROM templates WHERE user_id = ? AND categoria_id = ? AND idioma = ? AND tipo = ? AND nombre = ? AND contenido = ? AND orden = ?');
    const upsertTpl = db.prepare(`INSERT INTO templates (id, user_id, categoria_id, idioma, tipo, nombre, contenido, orden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, categoria_id=excluded.categoria_id, idioma=excluded.idioma,
        tipo=excluded.tipo, nombre=excluded.nombre, contenido=excluded.contenido, orden=excluded.orden,
        created_at=excluded.created_at, updated_at=excluded.updated_at
      WHERE templates.user_id = excluded.user_id`);
    for (const t of data.templates ?? []) {
      const owner = ownerTpl.get(t.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const dup = dupTpl.get(userId, t.categoria_id, t.idioma, t.tipo, t.nombre, t.contenido, t.orden ?? 0);
      if (dup && (dup as any).id !== t.id) { skipped++; continue; }
      upsertTpl.run(t.id, userId, t.categoria_id, t.idioma, t.tipo, t.nombre, t.contenido, t.orden ?? 0, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString());
    }

    // Config: dedup por (clave, valor)
    const dupCfg = db.prepare('SELECT id FROM config WHERE user_id = ? AND clave = ? AND valor = ?');
    const upsertCfg = db.prepare(`INSERT INTO config (id, user_id, clave, valor) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, clave=excluded.clave, valor=excluded.valor
      WHERE config.user_id = excluded.user_id`);
    for (const c of data.config ?? []) {
      const owner = ownerCfg.get(c.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const dup = dupCfg.get(userId, c.clave, c.valor ?? '');
      if (dup && (dup as any).id !== c.id) { skipped++; continue; }
      upsertCfg.run(c.id, userId, c.clave, c.valor ?? '');
    }

    // Tags: dedup por (nombre, color)
    const dupTag = db.prepare('SELECT id FROM tags WHERE user_id = ? AND nombre = ? AND color = ?');
    const upsertTag = db.prepare(`INSERT INTO tags (id, user_id, nombre, color, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, nombre=excluded.nombre, color=excluded.color, created_at=excluded.created_at
      WHERE tags.user_id = excluded.user_id`);
    for (const t of data.tags ?? []) {
      const owner = ownerTag.get(t.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const dup = dupTag.get(userId, t.nombre, t.color ?? '');
      if (dup && (dup as any).id !== t.id) { skipped++; continue; }
      upsertTag.run(t.id, userId, t.nombre, t.color ?? '', t.created_at || new Date().toISOString());
    }

    // Idiomas: dedup por nombre
    const dupIdiom = db.prepare('SELECT id FROM idiomas WHERE user_id = ? AND nombre = ?');
    const upsertIdiom = db.prepare(`INSERT INTO idiomas (id, user_id, nombre, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, nombre=excluded.nombre, created_at=excluded.created_at
      WHERE idiomas.user_id = excluded.user_id`);
    for (const i of data.idiomas ?? []) {
      const owner = ownerIdiom.get(i.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const dup = dupIdiom.get(userId, i.nombre);
      if (dup && (dup as any).id !== i.id) { skipped++; continue; }
      upsertIdiom.run(i.id, userId, i.nombre, i.created_at || new Date().toISOString());
    }

    // Postulaciones: dedup por todos los campos significativos (excluye id, created_at)
    const dupPost = db.prepare(`SELECT id FROM postulaciones WHERE user_id = ? AND
      empresa = ? AND oferta_laboral = ? AND COALESCE(categoria_id, -1) = COALESCE(?, -1) AND COALESCE(idioma, '') = COALESCE(?, '') AND
      nombre_empleado = ? AND puesto_empleado = ? AND template_ids = ? AND valores_usados = ? AND
      COALESCE(resultado_email, '') = COALESCE(?, '') AND COALESCE(resultado_empresa, '') = COALESCE(?, '') AND COALESCE(resultado_recruiter, '') = COALESCE(?, '') AND
      notas = ? AND estado = ? AND link_empresa = ? AND contacto_empleado = ? AND
      favorito = ? AND COALESCE(deleted_at, '') = COALESCE(?, '') AND fecha = ?`);
    const upsertPost = db.prepare(`INSERT INTO postulaciones
      (id, user_id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
        template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado,
        link_empresa, contacto_empleado, favorito, deleted_at, fecha, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id=excluded.user_id, empresa=excluded.empresa, oferta_laboral=excluded.oferta_laboral, categoria_id=excluded.categoria_id,
        idioma=excluded.idioma, nombre_empleado=excluded.nombre_empleado, puesto_empleado=excluded.puesto_empleado,
        template_ids=excluded.template_ids, valores_usados=excluded.valores_usados,
        resultado_email=excluded.resultado_email, resultado_empresa=excluded.resultado_empresa,
        resultado_recruiter=excluded.resultado_recruiter, notas=excluded.notas, estado=excluded.estado,
        link_empresa=excluded.link_empresa, contacto_empleado=excluded.contacto_empleado,
        favorito=excluded.favorito, deleted_at=excluded.deleted_at, fecha=excluded.fecha, created_at=excluded.created_at
      WHERE postulaciones.user_id = excluded.user_id`);
    for (const p of (data.postulaciones ?? []) as any[]) {
      const owner = ownerPost.get(p.id) as any;
      if (owner && owner.user_id !== userId) { skipped++; continue; }
      const tid = JSON.stringify(p.template_ids || []);
      const vals = JSON.stringify(p.valores_usados || {});
      const dup = dupPost.get(
        userId, p.empresa, p.oferta_laboral || '', p.categoria_id ?? null, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', tid, vals,
        p.resultado_email ?? null, p.resultado_empresa ?? null, p.resultado_recruiter ?? null,
        p.notas || '', p.estado || 'solicitado', p.link_empresa || '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, p.fecha || new Date().toISOString(),
      );
      if (dup && (dup as any).id !== p.id) { skipped++; continue; }
      upsertPost.run(
        p.id, userId, p.empresa, p.oferta_laboral || '', p.categoria_id ?? null, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', tid, vals,
        p.resultado_email ?? null, p.resultado_empresa ?? null, p.resultado_recruiter ?? null,
        p.notas || '', p.estado || 'solicitado', p.link_empresa || '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, p.fecha || new Date().toISOString(), p.created_at || new Date().toISOString(),
      );
    }

    // Reiniciar secuencias de autoincrement a lo máximo insertado (solo del usuario).
    for (const [t, col] of ([['categorias', 'id'], ['templates', 'id'], ['config', 'id'], ['tags', 'id'], ['idiomas', 'id'], ['postulaciones', 'id']] as [string, string][])) {
      const mx = db.prepare(`SELECT MAX(${col}) as m FROM ${t} WHERE user_id = ?`).get(userId) as any;
      if (mx?.m != null) {
        const cur = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(t) as any;
        if (!cur || mx.m > cur.seq) db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(mx.m, t);
      }
    }
    return { skipped };
  });

  db.pragma('foreign_keys = OFF');
  try {
    const result = merge();
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id = ?`).get(userId) as any).c;
    }
    res.json({ ok: true, skipped: result?.skipped ?? 0, counts });
  } catch (e: any) {
    res.status(500).json({ error: 'Error al importar el backup: ' + e.message });
  } finally {
    db.pragma('foreign_keys = ON');
  }
});

export default router;
