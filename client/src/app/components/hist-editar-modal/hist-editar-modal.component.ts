import { Component, Input, Output, EventEmitter, WritableSignal, Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstadoOption } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';

@Component({
  selector: 'app-hist-editar-modal',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './hist-editar-modal.component.html',
})
export class HistEditarModalComponent {
  @Input() editModal!: WritableSignal<boolean>;
  @Input() editForm: any = {};
  @Input() editUsed!: Signal<Set<string>>;
  @Input() editEmpresaOptions: string[] = [];
  @Input() estados: EstadoOption[] = [];
  @Input() OTRAS = '';
  @Input() estadoLabel: (v: string) => string = (v) => v;

  @Output() empresaChange = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  constructor(public i18n: I18nService) {}
}