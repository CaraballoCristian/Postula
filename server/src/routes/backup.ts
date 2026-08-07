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

// Import/restaurar: trae el historial (postulaciones) con su contexto de categorías,
// plantillas e idiomas. NO importa config (datos personales) ni tags (evita duplicar
// nombres renombrados). Las categorías/plantillas/idiomas se reaplican "crear si falta",
// nunca actualizan lo existente. El estado de cada postulación se conserva solo si ya
// existe como tag en la cuenta; si no, se reemplaza por el tag por defecto de la cuenta.
router.post('/import', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const userId = req.userId!;

  const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };

  // ── Tags existentes (no se importan; solo se usan para validar/coercionar estado) ──
  const existingTags = db.prepare('SELECT nombre FROM tags WHERE user_id = ? ORDER BY id').all(userId) as any[];
  const tagNames = new Set(existingTags.map((t: any) => String(t.nombre)));
  const fallbackEstado = existingTags.length ? String(existingTags[0].nombre) : 'solicitado';

  // ── Categorías (crear si falta por (user, nombre)) ──
  const catMap = new Map<number, number | null>();
  {
    const getCat = db.prepare('SELECT id FROM categorias WHERE user_id = ? AND nombre = ?');
    const insCat = db.prepare('INSERT INTO categorias (user_id, nombre, created_at) VALUES (?, ?, ?)');
    for (const c of (data.categorias ?? []) as any[]) {
      const name = String(c.nombre || '').trim();
      if (!name) continue;
      let found = getCat.get(userId, name) as any;
      if (!found) found = { id: insCat.run(userId, name, c.created_at || new Date().toISOString()).lastInsertRowid };
      catMap.set(num(c.id, 0), found.id);
    }
  }

  // ── Idiomas ( crear si no existe por (user, nombre)) ──
  const idiMap = new Map<number, number | null>();
  {
    const getIdi = db.prepare('SELECT id FROM idiomas WHERE user_id = ? AND nombre = ?');
    const insIdi = db.prepare('INSERT INTO idiomas (user_id, nombre, created_at) VALUES (?, ?, ?)');
    for (const i of (data.idiomas ?? []) as any[]) {
      const name = String(i.nombre || '').trim();
      if (!name) continue;
      let found = getIdi.get(userId, name) as any;
      if (!found) found = { id: insIdi.run(userId, name, i.created_at || new Date().toISOString()).lastInsertRowid };
      idiMap.set(num(i.id, 0), found.id);
    }
  }

  // ── Plantillas ( crear si no existe por contenido + categoría ya re-mapeada) ──
  const tplMap = new Map<number, number | null>();
  {
    const getTpl = db.prepare(`SELECT id FROM templates WHERE user_id = ? AND categoria_id = ? AND idioma = ? AND tipo = ? AND nombre = ? AND contenido = ? AND orden = ?`);
    const insTpl = db.prepare(`INSERT INTO templates (user_id, categoria_id, idioma, tipo, nombre, contenido, orden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const t of (data.templates ?? []) as any[]) {
      const catId = catMap.get(num(t.categoria_id, 0)) ?? null;
      let found = getTpl.get(userId, catId, t.idioma, t.tipo, t.nombre, t.contenido ?? '', t.orden ?? 0) as any;
      if (!found) {
        found = { id: insTpl.run(
          userId, catId, t.idioma, t.tipo, t.nombre, t.contenido ?? '', t.orden ?? 0,
          t.created_at || new Date().toISOString(), t.updated_at || t.created_at || new Date().toISOString()
        ).lastInsertRowid };
      }
      tplMap.set(num(t.id, 0), found.id);
    }
  }

  // ── Postulaciones (id nuevo; dedup; estado validado contra tags existentes) ──
  const merge = db.transaction(() => {
    let skipped = 0;
    const mapTpl = (ids: any): number[] => {
      const out: number[] = [];
      for (const x of (ids ?? [])) {
        const id = tplMap.get(num(x, 0));
        if (id != null) out.push(id);
      }
      return out;
    };
    const dupPost = db.prepare(`SELECT id FROM postulaciones WHERE user_id = ? AND
      empresa = ? AND oferta_laboral = ? AND COALESCE(categoria_id,-1) = COALESCE(?,-1) AND COALESCE(idioma,'') = COALESCE(?,'') AND
      COALESCE(fecha,'') = COALESCE(?,'')`);
    const insPost = db.prepare(`INSERT INTO postulaciones
      (user_id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
        template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado,
        link_empresa, contacto_empleado, favorito, deleted_at, fecha, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of (data.postulaciones ?? []) as any[]) {
      const catId = catMap.get(num(p.categoria_id, 0)) ?? null;
      const tplIds = mapTpl(p.template_ids);
      const fecha = p.fecha || new Date().toISOString();
      let estado = String(p.estado || 'solicitado');
      if (!tagNames.has(estado)) estado = fallbackEstado;
      const dup = dupPost.get(userId, p.empresa, p.oferta_laboral || '', catId, p.idioma ?? null, fecha) as any;
      if (dup) { skipped++; continue; }
      insPost.run(
        userId, p.empresa, p.oferta_laboral || '', catId, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', JSON.stringify(tplIds),
        JSON.stringify(p.valores_usados || {}),
        p.resultado_email ?? null, p.resultado_empresa ?? null, p.resultado_recruiter ?? null,
        p.notas || '', estado, p.link_empresa || '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, fecha, p.created_at || fecha,
      );
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