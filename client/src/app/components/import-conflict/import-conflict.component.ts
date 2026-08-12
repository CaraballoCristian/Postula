import { Component, signal, computed, input, output, effect } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';

export type ImportChoice = {
  link: 'existing' | 'imported';
  mensaje: 'existing' | 'imported';
  posts: Record<string, 'existing' | 'imported'>;
};

export type PostConflict = {
  key: string;
  oferta: string;
  fecha: string;
  fields: string[];
  existingId: number | null;
  importedIdx: number;
  existing: Record<string, string | null>;
  imported: Record<string, string | null>;
};

export type ImportConflictGroup = {
  key: string;
  nombre: string;
  existing: { link: string | null; mensaje: string | null; count: number };
  imported: { link: string | null; mensaje: string | null; count: number };
  conflictLink: boolean;
  conflictMensaje: boolean;
  postConflicts: PostConflict[];
};

const FIELD_LABELS: Record<string, string> = {
  resultado_email: '✉ Email',
  resultado_recruiter: '👤 Recruiter',
  contacto_empleado: '📞 Contacto',
  notas: '📝 Notas',
  favorito: '⭐ Favorito',
  estado: '🏷 Estado',
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
  conflictos = computed(() => this.groups().filter(g => g.conflictLink || g.conflictMensaje || (g.postConflicts?.length ?? 0) > 0));

  choices = signal<Record<string, ImportChoice>>({});
  open = signal<Set<string>>(new Set());
  openPosts = signal<Set<string>>(new Set());

  constructor(public i18n: I18nService) {
    effect(() => {
      const map: Record<string, ImportChoice> = {};
      for (const g of this.conflictos()) {
        const posts: Record<string, 'existing' | 'imported'> = {};
        for (const pc of g.postConflicts ?? []) {
          posts[pc.key] = 'existing';
        }
        map[g.key] = {
          link: g.conflictLink ? (g.existing.link ? 'existing' : 'imported') : 'existing',
          mensaje: g.conflictMensaje ? (g.existing.mensaje ? 'existing' : 'imported') : 'existing',
          posts,
        };
      }
      this.choices.set(map);
      // Las tarjetas con conflicto arrancan cerradas; se despliegan con clic para elegir.
      this.open.set(new Set());
      this.openPosts.set(new Set());
    });
  }

  toggleOpen(g: ImportConflictGroup) {
    this.open.update(s => {
      const n = new Set(s);
      if (n.has(g.key)) n.delete(g.key); else n.add(g.key);
      return n;
    });
  }

  togglePostOpen(g: ImportConflictGroup, pc: PostConflict) {
    this.openPosts.update(s => {
      const k = `${g.key}::${pc.key}`;
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  isPostOpen(g: ImportConflictGroup, pc: PostConflict): boolean {
    return this.openPosts().has(`${g.key}::${pc.key}`);
  }

  pick(g: ImportConflictGroup, field: 'link' | 'mensaje', value: 'existing' | 'imported') {
    this.choices.update(c => {
      const prev = c[g.key] ?? { link: 'existing' as const, mensaje: 'existing' as const, posts: {} };
      return { ...c, [g.key]: { ...prev, [field]: value } };
    });
  }

  pickPost(g: ImportConflictGroup, pc: PostConflict, value: 'existing' | 'imported') {
    this.choices.update(c => {
      const prev = c[g.key] ?? { link: 'existing' as const, mensaje: 'existing' as const, posts: {} };
      return { ...c, [g.key]: { ...prev, posts: { ...prev.posts, [pc.key]: value } } };
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

  postVal(g: ImportConflictGroup, pc: PostConflict): 'existing' | 'imported' {
    return this.choices()[g.key]?.posts?.[pc.key] ?? 'existing';
  }

  fieldLabel(f: string): string {
    return FIELD_LABELS[f] ?? f;
  }

  previewVals(pc: PostConflict, side: 'existing' | 'imported'): string {
    const vals = side === 'existing' ? pc.existing : pc.imported;
    return pc.fields
      .map(f => `${this.fieldLabel(f)}: ${vals[f] ?? '—'}`)
      .join('\n');
  }
}