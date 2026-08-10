import { Router, Response } from 'express';
import db from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const TABLES = ['categorias', 'templates', 'config', 'idiomas', 'tags', 'postulaciones'] as const;

// Estado especial que representa la ausencia de etiqueta (igual que `OTRAS` del cliente).
// No es una tag real: no se inserta en `tags`, no aparece en Configuración → Estados.
const SIN_ETIQUETA = '__otras__';

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

// ── Utilidades de merge por empresa (case-insensitive) ──
type GrupoInfo = {
  key: string;
  nombre: string;
  existing: { link: string | null; mensaje: string | null; count: number };
  imported: { link: string | null; mensaje: string | null; count: number };
  conflictLink: boolean;
  conflictMensaje: boolean;
};

type Decision = { link: 'existing' | 'imported'; mensaje: 'existing' | 'imported' };
type GroupPlan = { canonical: string | null; link: string | null; mensaje: string | null };

const keyOf = (name: unknown) => (typeof name === 'string' ? name.trim().toLowerCase() : '');

function firstNonEmpty(rows: any[], get: (r: any) => unknown): string | null {
  for (const r of rows) {
    const v = get(r);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

type SideInfo = {
  count: number;
  nombre: string;
  links: Set<string>;
  msgs: Set<string>;
  repLink: string | null;
  repMensaje: string | null;
};

const emptySide = (): SideInfo => ({ count: 0, nombre: '', links: new Set(), msgs: new Set(), repLink: null, repMensaje: null });

// Los sets se usan solo para DETECTAR diferencias: se normalizan (trim + lowercase) para que
// "Google.com" !== "google.com" (o con espacios) no dispare un conflicto inexistente. Los valores
// representativos (repLink/repMensaje) conservan el string original que se muestra/importa.
function addValues(side: SideInfo, rows: any[], getLink: (r: any) => unknown, getMsg: (r: any) => unknown) {
  for (const r of rows) {
    const l = getLink(r); if (typeof l === 'string' && l.trim()) side.links.add(l.trim().toLowerCase());
    const m = getMsg(r); if (typeof m === 'string' && m.trim()) side.msgs.add(m.trim().toLowerCase());
  }
  if (!side.repLink) side.repLink = firstNonEmpty(rows, getLink);
  if (!side.repMensaje) side.repMensaje = firstNonEmpty(rows, getMsg);
}

// Agrupa posts existentes del usuario + posts del backup por empresa (sin diferenciar mayúsculas).
// El conflicto se detecta comparando el CONJUNTO de valores distintos (link/mensaje) de cada lado:
// si ambos lados tienen valores y alguno difiere, hay conflicto. Así se detectan también diferencias
// que caen en posts no-primero (antes solo se comparaba el primer valor y se perdían conflictos).
function computeGroups(data: any, userId: number): Map<string, GrupoInfo> {
  const existingPosts = db.prepare(
    'SELECT empresa, link_empresa, resultado_empresa FROM postulaciones WHERE user_id = ? AND deleted_at IS NULL'
  ).all(userId) as any[];
  const existingEmp = db.prepare('SELECT nombre, link, resultado_empresa FROM empresas WHERE user_id = ?').all(userId) as any[];

  const postsByKey = new Map<string, any[]>();
  const accountByKey = new Map<string, SideInfo>();
  for (const p of existingPosts) {
    const key = keyOf(p.empresa);
    if (!key) continue;
    const arr = postsByKey.get(key) ?? [];
    arr.push(p);
    postsByKey.set(key, arr);
    const side = accountByKey.get(key) ?? emptySide();
    side.count++;
    if (!side.nombre) side.nombre = String(p.empresa).trim();
    accountByKey.set(key, side);
  }
  for (const [key, list] of postsByKey) {
    const side = accountByKey.get(key)!;
    addValues(side, list, r => r.link_empresa, r => r.resultado_empresa);
  }
  for (const e of existingEmp) {
    const key = keyOf(e.nombre);
    if (!key) continue;
    const side = accountByKey.get(key) ?? emptySide();
    if (e.link) {
      side.links.add(String(e.link).trim().toLowerCase());
      side.repLink = String(e.link).trim(); // el registro de empresa es la fuente de verdad
    }
    if (e.resultado_empresa) {
      side.msgs.add(String(e.resultado_empresa).trim().toLowerCase());
      side.repMensaje = String(e.resultado_empresa).trim();
    }
    if (!side.nombre) side.nombre = String(e.nombre).trim();
    accountByKey.set(key, side);
  }

  const importedByKey = new Map<string, SideInfo>();
  const impPostsByKey = new Map<string, any[]>();
  for (const p of (data.postulaciones ?? []) as any[]) {
    const key = keyOf(p.empresa);
    if (!key) continue;
    const arr = impPostsByKey.get(key) ?? [];
    arr.push(p);
    impPostsByKey.set(key, arr);
    const side = importedByKey.get(key) ?? emptySide();
    side.count++;
    if (!side.nombre) side.nombre = String(p.empresa).trim();
    importedByKey.set(key, side);
  }
  for (const [key, list] of impPostsByKey) {
    const side = importedByKey.get(key)!;
    addValues(side, list, r => r.link_empresa, r => r.resultado_empresa);
  }

  const nameByKey = new Map<string, string>();
  for (const [k, side] of accountByKey) if (!nameByKey.has(k)) nameByKey.set(k, side.nombre);
  for (const [k, side] of importedByKey) if (!nameByKey.has(k)) nameByKey.set(k, side.nombre);

  // Conflicto si la empresa existe en ambos lados y alguno de ellos trae un valor (link/mensaje)
  // que no coincide con el otro lado. Un lado vacío cuenta como diferencia. Si la empresa solo
  // existe en un lado no hay conflicto (se importa/ignora directamente).
  const differs = (a: Set<string>, b: Set<string>, exCount: number, imCount: number) =>
    exCount > 0 && imCount > 0 && (a.size > 0 || b.size > 0) &&
    (a.size !== b.size || Array.from(a).some(v => !b.has(v)) || Array.from(b).some(v => !a.has(v)));

  const groups = new Map<string, GrupoInfo>();
  const keys = new Set([...accountByKey.keys(), ...importedByKey.keys()]);
  for (const key of keys) {
    const ex = accountByKey.get(key) ?? emptySide();
    const im = importedByKey.get(key) ?? emptySide();
    groups.set(key, {
      key,
      nombre: nameByKey.get(key) ?? '',
      existing: { link: ex.repLink, mensaje: ex.repMensaje, count: ex.count },
      imported: { link: im.repLink, mensaje: im.repMensaje, count: im.count },
      conflictLink: differs(ex.links, im.links, ex.count, im.count),
      conflictMensaje: differs(ex.msgs, im.msgs, ex.count, im.count),
    });
  }
  return groups;
}

/** Merge por empresa (case-insensitive) con selección de qué conservar en caso de conflicto. */
router.post('/preview', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const groups = [...computeGroups(data, req.userId!).values()];
  console.error(`[backup] preview user=${req.userId} grupos=${groups.length} conflictos=${groups.filter(g => g.conflictLink || g.conflictMensaje).length}`);
  res.json({ groups });
});

// Import/restaurar: trae el historial (postulaciones) con su contexto de categorías,
// plantillas e idiomas. NO importa config (datos personales) ni tags (evita duplicar
// nombres renombrados). Las categorías/plantillas/idiomas se reaplican "crear si falta",
// nunca actualizan lo existente. El estado de cada postulación se conserva tal cual viene
// del backup; si la etiqueta no existe en la cuenta, la postulación agrupa en "Sin etiqueta".
// Las postulaciones de empresas ya existentes se fusionan: adoptan el nombre canónico y el
// link/mensaje elegido (o el no-vacío si solo una lo trae; en conflicto se usa 'decisions').
router.post('/import', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  const decisions = (req.body?.decisions ?? {}) as Record<string, Decision>;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const userId = req.userId!;

  const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };

  // Tags reales de la cuenta receptora (case-insensitive): si el estado del backup coincide con
  // una etiqueta existente se usa su nombre canónico; si no, queda SIN_ETIQUETA (ausencia de tag).
  const tagNames = new Map<string, string>();
  for (const t of (db.prepare('SELECT nombre FROM tags WHERE user_id = ?').all(userId) as any[])) {
    const n = String(t.nombre || '').trim();
    if (n) tagNames.set(n.toLowerCase(), n);
  }
  const normalizeEstado = (raw: unknown): string => {
    const clean = raw != null ? String(raw).trim() : '';
    if (!clean) return 'solicitado';
    return tagNames.get(clean.toLowerCase()) ?? SIN_ETIQUETA;
  };

  // Plan de merge por empresa
  const groups = computeGroups(data, userId);
  const planByKey = new Map<string, GroupPlan>();
  for (const g of groups.values()) {
    const d = decisions[g.key];
    const link = d?.link === 'imported' ? g.imported.link : d?.link === 'existing' ? g.existing.link : (g.existing.link || g.imported.link);
    const mensaje = d?.mensaje === 'imported' ? g.imported.mensaje : d?.mensaje === 'existing' ? g.existing.mensaje : (g.existing.mensaje || g.imported.mensaje);
    const canonical = g.existing.count > 0 ? g.nombre : null;
    planByKey.set(g.key, { canonical, link, mensaje });
  }

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

  // ── Postulaciones (id nuevo; dedup; merge por empresa) ──
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
      // El estado se normaliza a la tag de la cuenta (si coincide) o a SIN_ETIQUETA ("Sin etiqueta").
      // Se conserva el estado original solo si la tag ya existe en la cuenta receptora.
      const estado = normalizeEstado(p.estado);
      // Merge por empresa: nombre canónico y link/mensaje según decisión (o no-vacío).
      const plan = planByKey.get(keyOf(p.empresa));
      const empresa = plan?.canonical ?? String(p.empresa || '').trim();
      const link = plan?.link ?? (typeof p.link_empresa === 'string' ? p.link_empresa.trim() : '');
      const mensaje = plan?.mensaje ?? (typeof p.resultado_empresa === 'string' ? p.resultado_empresa.trim() : null);
      const dup = dupPost.get(userId, empresa, p.oferta_laboral || '', catId, p.idioma ?? null, fecha) as any;
      if (dup) { skipped++; continue; }
      insPost.run(
        userId, empresa, p.oferta_laboral || '', catId, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', JSON.stringify(tplIds),
        JSON.stringify(p.valores_usados || {}),
        p.resultado_email ?? null, mensaje, p.resultado_recruiter ?? null,
        p.notas || '', estado, link, p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, fecha, p.created_at || fecha,
      );
    }
    // Alinea link/mensaje en las postulaciones ya existentes de empresas fusionadas.
    // COALESCE: si el plan no trae valor (null), se conserva el link/mensaje previo del post
    // en vez de pisarlo (link_empresa es NOT NULL, un UPDATE con NULL haría rollback de todo).
    const alignPost = db.prepare(
      'UPDATE postulaciones SET link_empresa = COALESCE(?, link_empresa), resultado_empresa = COALESCE(?, resultado_empresa) WHERE user_id = ? AND lower(empresa) = ? AND deleted_at IS NULL'
    );
    let merged = 0;
    for (const [key, plan] of planByKey) {
      if (!plan.canonical || (plan.link == null && plan.mensaje == null)) continue;
      alignPost.run(plan.link, plan.mensaje, userId, key);
      merged++;
    }

    // Sincroniza `empresas` (fuente de verdad del link/mensaje en historial) con el plan final.
    // Se aplica a TODAS las empresas del backup: si la fila existe se actualiza con COALESCE
    // (conserva lo previo cuando el plan no trae valor); si es nueva se crea con lo elegido.
    const getEmp = db.prepare('SELECT id FROM empresas WHERE user_id = ? AND lower(nombre) = lower(?)');
    const updEmp = db.prepare(
      'UPDATE empresas SET link = COALESCE(?, link), resultado_empresa = COALESCE(?, resultado_empresa) WHERE user_id = ? AND lower(nombre) = lower(?)'
    );
    const insEmp = db.prepare('INSERT INTO empresas (user_id, nombre, link, resultado_empresa) VALUES (?, ?, ?, ?)');
    for (const g of groups.values()) {
      const plan = planByKey.get(g.key);
      if (!plan) continue;
      const nombre = plan.canonical ?? g.nombre;
      if (!nombre) continue;
      const existing = getEmp.get(userId, nombre) as any;
      if (existing) {
        updEmp.run(plan.link, plan.mensaje, userId, nombre);
      } else {
        insEmp.run(userId, nombre, plan.link ?? '', plan.mensaje ?? '');
      }
    }
    return { skipped, merged };
  });

  db.pragma('foreign_keys = OFF');
  try {
    const result = merge();
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id = ?`).get(userId) as any).c;
    }
    res.json({ ok: true, skipped: result?.skipped ?? 0, merged: result?.merged ?? 0, counts });
  } catch (e: any) {
    res.status(500).json({ error: 'Error al importar el backup: ' + e.message });
  } finally {
    db.pragma('foreign_keys = ON');
  }
});

export default router;