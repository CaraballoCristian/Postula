import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Postulacion, EstadoOption } from '../../models/interfaces';
import { OTRAS } from '../../models/constants';
import { I18nService } from '../../services/i18n.service';
import { fixUrl as fixUrlUtil, formatFecha as formatFechaUtil, stagger as staggerUtil } from '../../utils/utils';

interface TableCol {
  field: string;
  labelKey: any;
}

@Component({
  selector: 'app-postulacion-table',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './postulacion-table.component.html',
})
export class PostulacionTableComponent {
  @Input() rows: Postulacion[] = [];
  @Input() columns: TableCol[] = [];
  @Input() selectionMode = false;
  @Input() trashMode = false;
  @Input() sortField = '';
  @Input() sortDir: 'asc' | 'desc' = 'desc';
  @Input() expandedId: number | null = null;
  @Input() expandedMsg: string | null = null;
  @Input() estados: EstadoOption[] = [];
  @Input() catNombres: Record<number, string> = {};
  @Input() isSelected: (id: number) => boolean = () => false;
  @Input() hideEmpresaLink = false;

  @Output() toggleFav = new EventEmitter<Postulacion>();
  @Output() toggleSelect = new EventEmitter<number>();
  @Output() toggleSort = new EventEmitter<string>();
  @Output() view = new EventEmitter<number>();
  @Output() edit = new EventEmitter<Postulacion>();
  @Output() delete = new EventEmitter<number>();
  @Output() restore = new EventEmitter<number>();
  @Output() deleteForGood = new EventEmitter<number>();
  @Output() toggleMsg = new EventEmitter<string>();
  @Output() copy = new EventEmitter<string>();

  @Output() longPressStart = new EventEmitter<number>();

  msgTipos = ['email', 'mensaje_empresa', 'mensaje_recruiter'];
  hoverRow: number | null = null;
  private longPressTimer: any = null;
  longPressTriggered = false;

  constructor(public i18n: I18nService) {}

  get colspan(): number {
    return (this.selectionMode ? 1 : 0) + this.columns.length + 1;
  }

  show(field: string): boolean {
    return this.columns.some(c => c.field === field);
  }

  catNombre(id: number) {
    return this.catNombres[id] ? this.i18n.categoriaLabel(this.catNombres[id]) : '';
  }

  estadoLabel(v: string) {
    const known = this.estados.find(e => e.value === v);
    if (known) return known.label;
    // Cualquier estado huérfano (importado con tag que no existe en la cuenta) se muestra
    // como "Sin etiqueta" en vez del nombre literal del backup.
    const otras = this.estados.find(e => e.value === OTRAS);
    return otras?.label ?? v;
  }
  estadoColor(v: string) {
    const known = this.estados.find(e => e.value === v);
    if (known) return known.color;
    const otras = this.estados.find(e => e.value === OTRAS);
    return otras?.color ?? '#eee';
  }
  // Texto según el fondo: sobre #eee (sin etiqueta / inválido) va oscuro; sobre colores fuertes, blanco.
  estadoTextColor(v: string) {
    return this.estadoColor(v) === '#eee' ? '#18181b' : '#fff';
  }

  formatFecha(f: string) {
    return formatFechaUtil(f);
  }

  fixUrl(url: string): string {
    return fixUrlUtil(url);
  }

  stagger(i: number): string {
    return staggerUtil(i);
  }

  onTouchStart(id: number, event: TouchEvent) {
    if (this.selectionMode) return;
    this.longPressTriggered = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.longPressStart.emit(id);
    }, 500);
  }

  onTouchEnd() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onTouchMove() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
