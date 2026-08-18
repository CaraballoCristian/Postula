import { Component, Input, Output, EventEmitter, WritableSignal, Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Categoria, EstadoOption } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-hist-filtros',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './hist-filtros.component.html',
})
export class HistFiltrosComponent {
  @Input() filtroGlobal!: WritableSignal<string>;
  @Input() categorias: Categoria[] = [];
  @Input() checkedCategorias!: WritableSignal<Set<number>>;
  @Input() estados: EstadoOption[] = [];
  @Input() checkedEstados!: WritableSignal<Set<string>>;
  @Input() idiomas: string[] = [];
  @Input() checkedIdiomas!: WritableSignal<Set<string>>;
  @Input() openDropdown!: WritableSignal<'cat' | 'est' | 'idioma' | null>;
  @Input() viewMode!: Signal<'tabla' | 'empresa'>;
  @Input() selectionMode!: WritableSignal<boolean>;
  @Input() selectedIds!: WritableSignal<Set<number>>;
  @Input() trashMode!: WritableSignal<boolean>;
  @Input() filteredCount!: Signal<number>;
  @Input() empresaCount!: Signal<number>;
  @Input() bulkEstado = '';
  @Input() OTRAS = '';
  @Input() estadoLabel: (v: string) => string = (v) => v;

  @Output() bulkEstadoChange = new EventEmitter<string>();
  @Output() setView = new EventEmitter<'tabla' | 'empresa'>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() toggleSelectionMode = new EventEmitter<void>();
  @Output() toggleTrash = new EventEmitter<void>();
  @Output() applyBulk = new EventEmitter<void>();
  @Output() bulkDelete = new EventEmitter<void>();

  constructor(public i18n: I18nService) {}

  toggleDropdown(type: 'cat' | 'est' | 'idioma') {
    this.openDropdown.update(v => v === type ? null : type);
  }

  toggleCategoria(id: number) {
    this.checkedCategorias.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  toggleEstado(val: string) {
    this.checkedEstados.update(s => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n; });
  }

  toggleIdioma(nombre: string) {
    this.checkedIdiomas.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }
}