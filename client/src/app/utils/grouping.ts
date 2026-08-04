import { Postulacion } from '../models/interfaces';

export interface EmpresaGrupo {
  nombre: string;
  items: Postulacion[];
}

/**
 * Agrupa postulaciones por empresa (nombre exacto). El orden de los grupos y el
 * de los items dentro de cada grupo preserva el orden de entrada, de modo que
 * los filtros y el orden activo se aplican ANTES del agrupamiento.
 */
export function groupByEmpresa(list: Postulacion[]): EmpresaGrupo[] {
  const map = new Map<string, Postulacion[]>();
  for (const p of list) {
    const key = p.empresa;
    if (!key) continue;
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()].map(([nombre, items]) => ({ nombre, items }));
}
