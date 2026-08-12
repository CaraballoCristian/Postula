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
// Fuente única de link/mensaje de empresa = tabla `empresas`. Las postulaciones
// salen con esos campos vacíos para no duplicar; solo referencian por nombre.
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
        link_empresa: '',
        resultado_empresa: null,
        template_ids: JSON.parse(r.template_ids || '[]'),
        valores_usados: JSON.parse(r.valores_usados || '{}'),
      }))
    ),
    empresas: strip(db.prepare('SELECT * FROM empresas WHERE user_id = ? ORDER BY id').all(userId)),
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
  postConflicts: PostConflict[];
};

type Decision = { link: 'existing' | 'imported'; mensaje: 'existing' | 'imported'; posts: Record<string, 'existing' | 'imported'> };
type GroupPlan = { canonical: string | null; link: string | null; mensaje: string | null };

// Conflictos a nivel POSTULACIÓN: misma empresa + misma dedup-key (oferta/categoría/idioma/fecha)
// pero campos internos distintos. El usuario resuelve por post (Cuenta vs Backup).
const POST_FIELDS = ['resultado_email', 'resultado_recruiter', 'contacto_empleado', 'notas', 'favorito', 'estado'] as const;
type PostConflict = {
  key: string;
  oferta: string;
  fecha: string;
  fields: string[];
  existingId: number | null;
  importedIdx: number;
  existing: Record<string, string | null>;
  imported: Record<string, string | null>;
};

const keyOf = (name: unknown) => (typeof name === 'string' ? name.trim().toLowerCase() : '');
const norm = (v: unknown): string => (v == null ? '' : String(v).trim().toLowerCase());

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

// El link/mensaje de empresa vive en `empresas` (fuente única). Los sets se usan para
// DETECTAR diferencias (normalizados en minúsculas). El representativo guarda el string
// original. Si la fila empresa no trae valor (cuenta previa a la migración o backup viejo),
// se cae al primer no-vacío de las postulaciones.
function applyCompanyValues(side: SideInfo, emp: any | undefined, posts: any[], getLink: (r: any) => unknown, getMsg: (r: any) => unknown) {
  const empLink = emp && typeof emp.link === 'string' && emp.link.trim() ? String(emp.link).trim() : null;
  const empMsg = emp && typeof emp.resultado_empresa === 'string' && emp.resultado_empresa.trim() ? String(emp.resultado_empresa).trim() : null;
  if (empLink) { side.links.add(empLink.toLowerCase()); side.repLink = empLink; }
  if (empMsg) { side.msgs.add(empMsg.toLowerCase()); side.repMensaje = empMsg; }
  if (!empLink) {
    const l = firstNonEmpty(posts, getLink);
    if (l) { side.links.add(l.toLowerCase()); side.repLink = l; }
  }
  if (!empMsg) {
    const m = firstNonEmpty(posts, getMsg);
    if (m) { side.msgs.add(m.toLowerCase()); side.repMensaje = m; }
  }
}

const postKeyOf = (p: any) =>
  [String(p.oferta_laboral || '').toLowerCase(), String(p.categoria_id ?? ''), String(p.idioma || ''), String(p.fecha || '')].join('|');

// Empareja posts por dedup-key dentro de una empresa. Devuelve los pares que difieren
// en algún campo de POST_FIELDS (con la info que necesita el import para aplicar la decisión).
function pairPostConflicts(existings: any[], importeds: any[]): PostConflict[] {
  const used = new Set<number>();
  const out: PostConflict[] = [];
  for (let i = 0; i < importeds.length; i++) {
    const im = importeds[i];
    let exIdx = -1;
    for (let j = 0; j < existings.length; j++) {
      if (used.has(j)) continue;
      if (postKeyOf(existings[j]) === postKeyOf(im) && norm(existings[j].oferta_laboral) === norm(im.oferta_laboral)) {
        exIdx = j;
        break;
      }
    }
    if (exIdx < 0) continue;
    const ex = existings[exIdx];
    const fields: string[] = [];
    for (const f of POST_FIELDS) {
      if (f === 'favorito') {
        if ((Number(ex[f]) || 0) !== (Number(im[f]) || 0)) fields.push(f);
      } else {
        const a = ex[f] === undefined || ex[f] === null ? '' : String(ex[f]);
        const b = im[f] === undefined || im[f] === null ? '' : String(im[f]);
        if (norm(a) !== norm(b)) fields.push(f);
      }
    }
    if (fields.length === 0) { used.add(exIdx); continue; }
    used.add(exIdx);
    const exVals: Record<string, string | null> = {};
    const imVals: Record<string, string | null> = {};
    for (const f of fields) {
      exVals[f] = ex[f] == null ? null : String(ex[f]);
      imVals[f] = im[f] == null ? null : String(im[f]);
    }
    out.push({
      key: postKeyOf(im),
      oferta: String(im.oferta_laboral || ''),
      fecha: String(im.fecha || ''),
      fields,
      existingId: ex.id ?? null,
      importedIdx: i,
      existing: exVals,
      imported: imVals,
    });
  }
  return out;
}

// Agrupa empresas del usuario + del backup. El conflicto de link/mensaje se detecta
// comparando la fila `empresas` de cada lado (fuente única). Además se detectan
// conflictos por postulación (campos internos) para resolverlos en el modal.
function computeGroups(data: any, userId: number): Map<string, GrupoInfo> {
  const existingPosts = db.prepare(
    `SELECT id, empresa, oferta_laboral, categoria_id, idioma, link_empresa, resultado_empresa,
            resultado_email, resultado_recruiter, contacto_empleado, notas, favorito, estado, fecha
     FROM postulaciones WHERE user_id = ? AND deleted_at IS NULL`
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
  const empByKey = new Map<string, any>();
  for (const e of existingEmp) {
    const key = keyOf(e.nombre);
    if (!key) continue;
    if (!empByKey.has(key)) empByKey.set(key, e);
    const side = accountByKey.get(key) ?? emptySide();
    if (!side.nombre) side.nombre = String(e.nombre).trim();
    side.count = Math.max(side.count, 0);
    accountByKey.set(key, side);
  }
  for (const [key, emp] of empByKey) {
    const side = accountByKey.get(key)!;
    applyCompanyValues(side, emp, postsByKey.get(key) ?? [], r => r.link_empresa, r => r.resultado_empresa);
  }

  // Lado importado: empresas + posts del backup.
  const importedByKey = new Map<string, SideInfo>();
  const impPostsByKey = new Map<string, any[]>();
  const impEmpByKey = new Map<string, any>();
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
  for (const e of (data.empresas ?? []) as any[]) {
    const key = keyOf(e.nombre);
    if (!key) continue;
    if (!impEmpByKey.has(key)) impEmpByKey.set(key, e);
    const side = importedByKey.get(key) ?? emptySide();
    if (!side.nombre) side.nombre = String(e.nombre).trim();
    importedByKey.set(key, side);
  }
  for (const [key, emp] of impEmpByKey) {
    const side = importedByKey.get(key)!;
    applyCompanyValues(side, emp, impPostsByKey.get(key) ?? [], r => r.link_empresa, r => r.resultado_empresa);
  }

  const nameByKey = new Map<string, string>();
  for (const [k, side] of accountByKey) if (!nameByKey.has(k)) nameByKey.set(k, side.nombre);
  for (const [k, side] of importedByKey) if (!nameByKey.has(k)) nameByKey.set(k, side.nombre);

  const differs = (a: Set<string>, b: Set<string>, exCount: number, imCount: number) =>
    exCount > 0 && imCount > 0 && (a.size > 0 || b.size > 0) &&
    (a.size !== b.size || Array.from(a).some(v => !b.has(v)) || Array.from(b).some(v => !a.has(v)));

  const groups = new Map<string, GrupoInfo>();
  const keys = new Set([...accountByKey.keys(), ...importedByKey.keys()]);
  for (const key of keys) {
    const ex = accountByKey.get(key) ?? emptySide();
    const im = importedByKey.get(key) ?? emptySide();
    const postConflicts = pairPostConflicts(postsByKey.get(key) ?? [], impPostsByKey.get(key) ?? []);
    groups.set(key, {
      key,
      nombre: nameByKey.get(key) ?? '',
      existing: { link: ex.repLink, mensaje: ex.repMensaje, count: ex.count },
      imported: { link: im.repLink, mensaje: im.repMensaje, count: im.count },
      conflictLink: differs(ex.links, im.links, ex.count, im.count),
      conflictMensaje: differs(ex.msgs, im.msgs, ex.count, im.count),
      postConflicts,
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
  const conflictos = groups.filter(g => g.conflictLink || g.conflictMensaje).length;
  const posts = groups.reduce((acc, g) => acc + g.postConflicts.length, 0);
  console.error(`[backup] preview user=${req.userId} grupos=${groups.length} conflictos=${conflictos} posts=${posts}`);
  res.json({ groups });
});

// Import/restaurar: trae el historial (postulaciones) con su contexto de categorías,
// plantillas e idiomas. NO importa config (datos personales) ni tags (evita duplicar
// nombres renombrados). El link/mensaje de empresa se aplica solo en `empresas`
// (fuente única); las postulaciones referencian por nombre (campos vacíos).
// Las postulaciones del backup que coinciden por dedup-key con una existente se
// resuelven por decisión ('existing' la conserva, 'imported' la actualiza con los
// campos del backup); las que no coinciden se insertan como nuevas.
router.post('/import', (req: AuthRequest, res: Response) => {
  const data = req.body?.data;
  const decisions = (req.body?.decisions ?? {}) as Record<string, Decision>;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Estructura de backup inválida' });
    return;
  }
  const userId = req.userId!;

  const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };

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

  // Plan de merge por empresa (link/mensaje → solo `empresas`).
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

  // ── Postulaciones (id nuevo; dedup por empresa; resolución por post) ──
  const merge = db.transaction(() => {
    let skipped = 0;
    let updated = 0;
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
    const updatePostFields = db.prepare(
      `UPDATE postulaciones SET oferta_laboral = ?, template_ids = ?, resultado_email = ?,
        resultado_recruiter = ?, contacto_empleado = ?, notas = ?, favorito = ?, estado = ?
       WHERE id = ? AND user_id = ?`
    );
    const insPost = db.prepare(`INSERT INTO postulaciones
      (user_id, empresa, oferta_laboral, categoria_id, idioma, nombre_empleado, puesto_empleado,
        template_ids, valores_usados, resultado_email, resultado_empresa, resultado_recruiter, notas, estado,
        link_empresa, contacto_empleado, favorito, deleted_at, fecha, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const imported = (data.postulaciones ?? []) as any[];
    for (let i = 0; i < imported.length; i++) {
      const p = imported[i];
      const catId = catMap.get(num(p.categoria_id, 0)) ?? null;
      const tplIds = mapTpl(p.template_ids);
      const fecha = p.fecha || new Date().toISOString();
      const estado = normalizeEstado(p.estado);
      const empresaNom = String(p.empresa || '').trim();
      const key = keyOf(empresaNom);
      const plan = planByKey.get(key);
      const empresa = plan?.canonical ?? empresaNom;

      const dup = dupPost.get(userId, empresa, p.oferta_laboral || '', catId, p.idioma ?? null, fecha) as any;
      if (dup) {
        // Coincide con un post existente: aplicar decisión por post si el usuario eligió el backup.
        const d = decisions[key]?.posts?.[postKeyOf(p)];
        if (d === 'imported') {
          updatePostFields.run(
            p.oferta_laboral || '', JSON.stringify(tplIds),
            p.resultado_email ?? null, p.resultado_recruiter ?? null,
            p.contacto_empleado || '', p.notas || '', Number(p.favorito) || 0, estado,
            dup.id, userId,
          );
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      // Post nuevo: sin link/mensaje de empresa (referencia por nombre → `empresas`).
      insPost.run(
        userId, empresa, p.oferta_laboral || '', catId, p.idioma ?? null,
        p.nombre_empleado || '', p.puesto_empleado || '', JSON.stringify(tplIds),
        JSON.stringify(p.valores_usados || {}),
        p.resultado_email ?? null, null, p.resultado_recruiter ?? null,
        p.notas || '', estado, '', p.contacto_empleado || '',
        p.favorito ?? 0, p.deleted_at ?? null, fecha, p.created_at || fecha,
      );
    }

    // Sincroniza `empresas` (fuente de verdad del link/mensaje en historial) con el plan final.
    const getEmp = db.prepare('SELECT id FROM empresas WHERE user_id = ? AND lower(nombre) = lower(?)');
    const updEmp = db.prepare(
      'UPDATE empresas SET link = COALESCE(?, link), resultado_empresa = COALESCE(?, resultado_empresa) WHERE user_id = ? AND lower(nombre) = lower(?)'
    );
    const insEmp = db.prepare('INSERT INTO empresas (user_id, nombre, link, resultado_empresa) VALUES (?, ?, ?, ?)');
    let empCreated = 0;
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
        empCreated++;
      }
    }
    return { skipped, updated, empCreated };
  });

  db.pragma('foreign_keys = OFF');
  try {
    const result = merge();
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id = ?`).get(userId) as any).c;
    }
    counts.empresas = (db.prepare('SELECT COUNT(*) as c FROM empresas WHERE user_id = ?').get(userId) as any).c;
    res.json({ ok: true, skipped: result?.skipped ?? 0, updated: result?.updated ?? 0, empCreated: result?.empCreated ?? 0, counts });
  } catch (e: any) {
    res.status(500).json({ error: 'Error al importar el backup: ' + e.message });
  } finally {
    db.pragma('foreign_keys = ON');
  }
});

export default router;