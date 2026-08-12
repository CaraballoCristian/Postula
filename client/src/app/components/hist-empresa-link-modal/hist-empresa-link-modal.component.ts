import { Component, Input, Output, EventEmitter, Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';

export interface EmpresaLinkModalData {
  id: number | null;
  nombre: string;
  nombreOriginal: string;
  link: string;
  linkOriginal: string;
}

@Component({
  selector: 'app-hist-empresa-link-modal',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './hist-empresa-link-modal.component.html',
})
export class HistEmpresaLinkModalComponent {
  @Input() empresaLinkModal!: Signal<EmpresaLinkModalData | null>;

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  constructor(public i18n: I18nService) {}
}