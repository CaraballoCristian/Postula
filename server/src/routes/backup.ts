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

// Import/restaurar: trae SÓLO el historial (postulaciones). No modifica categorias,
// templates, config, idiomas ni tags (evita conflictos). Las categorías/plantillas del
// backup se usan únicamente como referencia (solo lectura) para remapear por nombre la
// categoría/plantilla de cada postulación hacia las YA existentes en la cuenta; si no
// hay match, la referencia queda vacía.
router.post('/import', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const userId = req.userId!;

  const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };

  // ── Referencia (solo lectura) para remapear por nombre ──
  // catMap: id de categoría del origen -> id (o null) de categoría EXISTENTE con el mismo nombre.
  // tplMap: id de plantilla del origen -> id de plantilla EXISTENTE con igual contenido.
  const buildCatMap = () => {
    const map = new Map<number, number | null>();
    const getCat = db.prepare('SELECT id FROM categorias WHERE user_id = ? AND nombre = ?');
    for (const c of (data.categorias ?? []) as any[]) {
      const name = String(c.nombre || '').trim();
      if (!name) continue;
      const found = getCat.get(userId, name) as any;
      map.set(num(c.id, 0), found ? found.id : null);
    }
    return map;
  };
  const catMap = buildCatMap();

  // Template matcheo por contenido del backup hacia la misma categoría ya remapeada.
  const buildTplMap = () => {
    const map = new Map<number, number | null>();
    const getTpl = db.prepare(`SELECT id FROM templates WHERE user_id = ? AND categoria_id = ? AND idioma = ? AND tipo = ? AND nombre = ? AND contenido = ? AND orden = ?`);
    for (const t of (data.templates ?? []) as any[]) {
      const catId = catMap.get(num(t.categoria_id, 0)) ?? null;
      const found = getTpl.get(userId, catId, t.idioma, t.tipo, t.nombre, t.contenido ?? '', t.orden ?? 0) as any;
      map.set(num(t.id, 0), found ? found.id : null);
    }
    return map;
  };
  const tplMap = buildTplMap();

  // ── Postulaciones ──
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
      const estado = String(p.estado || 'solicitado');
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