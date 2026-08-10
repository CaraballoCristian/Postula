import { Component, signal, computed, input, output, effect } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';

export type ImportChoice = { link: 'existing' | 'imported'; mensaje: 'existing' | 'imported' };
export type ImportConflictGroup = {
  key: string;
  nombre: string;
  existing: { link: string | null; mensaje: string | null; count: number };
  imported: { link: string | null; mensaje: string | null; count: number };
  conflictLink: boolean;
  conflictMensaje: boolean;
};

@Component({
  selector: 'app-import-conflict',
  standalone: true,
  imports: [BackdropDismissDirective],
  templateUrl: './import-conflict.component.html',
})
export class ImportConflictComponent {
  groups = input<ImportConflictGroup[]>([]);
  busy = input(false);
  confirmar = output<Record<string, ImportChoice>>();
  cancelar = output<void>();

  // Solo interesan las empresas con conflicto real; el resto se importa automáticamente.
  conflictos = computed(() => this.groups().filter(g => g.conflictLink || g.conflictMensaje));

  choices = signal<Record<string, ImportChoice>>({});
  open = signal<Set<string>>(new Set());
  openMsg = signal<Set<string>>(new Set());

  constructor(public i18n: I18nService) {
    effect(() => {
      const map: Record<string, ImportChoice> = {};
      for (const g of this.conflictos()) {
        map[g.key] = {
          link: g.conflictLink ? (g.existing.link ? 'existing' : 'imported') : 'existing',
          mensaje: g.conflictMensaje ? (g.existing.mensaje ? 'existing' : 'imported') : 'existing',
        };
      }
      this.choices.set(map);
      // Todas las tarjetas arrancan cerradas; el usuario las expande para decidir.
      this.open.set(new Set());
      this.openMsg.set(new Set());
    });
  }

  toggleOpen(g: ImportConflictGroup) {
    this.open.update(s => {
      const n = new Set(s);
      if (n.has(g.key)) n.delete(g.key); else n.add(g.key);
      return n;
    });
  }

  toggleMsg(g: ImportConflictGroup) {
    this.openMsg.update(s => {
      const n = new Set(s);
      if (n.has(g.key)) n.delete(g.key); else n.add(g.key);
      return n;
    });
  }

  pick(g: ImportConflictGroup, field: 'link' | 'mensaje', value: 'existing' | 'imported') {
    this.choices.update(c => {
      const prev = c[g.key] ?? { link: 'existing' as const, mensaje: 'existing' as const };
      return { ...c, [g.key]: { ...prev, [field]: value } };
    });
  }

  val(g: ImportConflictGroup, field: 'link' | 'mensaje'): 'existing' | 'imported' {
    return this.choices()[g.key]?.[field] ?? 'existing';
  }

  chosen(g: ImportConflictGroup, field: 'link' | 'mensaje'): string | null {
    return this.val(g, field) === 'imported'
      ? (field === 'link' ? g.imported.link : g.imported.mensaje)
      : (field === 'link' ? g.existing.link : g.existing.mensaje);
  }
}