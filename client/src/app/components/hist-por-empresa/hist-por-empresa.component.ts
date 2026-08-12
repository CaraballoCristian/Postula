import { Component, Input, Output, EventEmitter, WritableSignal, Signal } from '@angular/core';
import { Postulacion, EstadoOption } from '../../models/interfaces';
import { EmpresaGrupo } from '../../utils/grouping';
import { I18nService } from '../../services/i18n.service';
import { PostulacionTableComponent } from '../postulacion-table/postulacion-table.component';

type SortField = 'fecha' | 'empresa' | 'categoria_id' | 'idioma' | 'oferta_laboral' | 'nombre_empleado' | 'puesto_empleado' | 'favorito' | 'estado';

interface TableCol {
  field: string;
  labelKey: any;
}

@Component({
  selector: 'app-hist-por-empresa',
  standalone: true,
  imports: [PostulacionTableComponent],
  templateUrl: './hist-por-empresa.component.html',
})
export class HistPorEmpresaComponent {
  @Input() grupos!: Signal<EmpresaGrupo[]>;
  @Input() openEmpresas!: WritableSignal<Set<string>>;
  @Input() openEmpresaMensajes!: WritableSignal<Set<string>>;
  @Input() empresaSortDir!: Signal<'asc' | 'desc'>;
  @Input() selectionMode!: Signal<boolean>;
  @Input() sortField!: Signal<SortField>;
  @Input() sortDir!: Signal<'asc' | 'desc'>;
  @Input() expandedId!: Signal<number | null>;
  @Input() expandedMsg!: Signal<string | null>;
  @Input() estados: EstadoOption[] = [];
  @Input() catNombres: Record<number, string> = {};
  @Input() empresaTableColumns: TableCol[] = [];
  @Input() isSelected: (id: number) => boolean = () => false;
  @Input() hasFavorita: (g: EmpresaGrupo) => boolean = () => false;
  @Input() postCountLabel: (n: number) => string = () => '';
  @Input() empresaLink: (nombre: string) => string = () => '';
  @Input() getEmpresaMensaje: (nombre: string) => string | null = () => null;
  @Input() fixUrl: (url: string) => string = (url) => url;

  @Output() toggleEmpresaSort = new EventEmitter<void>();
  @Output() toggleEmpresa = new EventEmitter<string>();
  @Output() toggleEmpresaMensaje = new EventEmitter<string>();
  @Output() openEmpresaLinkModal = new EventEmitter<string>();
  @Output() deleteEmpresaGroup = new EventEmitter<EmpresaGrupo>();
  @Output() toggleFav = new EventEmitter<Postulacion>();
  @Output() toggleSelect = new EventEmitter<number>();
  @Output() toggleSort = new EventEmitter<string>();
  @Output() view = new EventEmitter<number>();
  @Output() edit = new EventEmitter<Postulacion>();
  @Output() delete = new EventEmitter<number>();
  @Output() toggleMsg = new EventEmitter<string>();
  @Output() copy = new EventEmitter<string>();

  constructor(public i18n: I18nService) {}
}