import { Injectable, signal, computed, effect } from '@angular/core';
import { es, TR } from '../i18n/es';
import { en } from '../i18n/en';
import { Lang, DEFAULT_TAG_LABELS, DEFAULT_CAT_LABELS } from '../i18n/labels';

const DICTS: Record<Lang, Record<TR, string>> = { es, en };

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<Lang>('es');

  constructor() {
    const saved = localStorage.getItem('postulatool.lang') as Lang | null;
    if (saved === 'es' || saved === 'en') this.lang.set(saved);
    effect(() => localStorage.setItem('postulatool.lang', this.lang()));
  }

  setLang(l: Lang) {
    this.lang.set(l);
  }

  t(key: TR, params?: Record<string, string | number>): string {
    let s = DICTS[this.lang()][key] ?? String(key);
    if (params) {
      for (const k of Object.keys(params)) {
        s = s.split(`{{${k}}}`).join(String(params[k]));
      }
    }
    return s;
  }

  // Solo traduce valores default; lo restante se muestra tal cual.
  tagLabel(nombre: string): string {
    const def = DEFAULT_TAG_LABELS[nombre];
    if (def) return def[this.lang()];
    return this.cap(nombre);
  }

  categoriaLabel(nombre: string): string {
    const def = DEFAULT_CAT_LABELS[nombre];
    if (def) return def[this.lang()];
    return nombre;
  }

  cap(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}