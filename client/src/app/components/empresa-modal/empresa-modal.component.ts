import { Component, Output, EventEmitter, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';

@Component({
  selector: 'app-empresa-modal',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './empresa-modal.component.html',
})
export class EmpresaModalComponent {
  open = signal(false);
  nombre = '';
  link = '';
  error = signal('');

  @Output() crear = new EventEmitter<{ nombre: string; link: string }>();
  @Output() cerrado = new EventEmitter<void>();

  constructor(public i18n: I18nService) {}

  abrir() {
    this.nombre = '';
    this.link = '';
    this.error.set('');
    this.open.set(true);
  }

  cerrar() {
    this.open.set(false);
    this.error.set('');
    this.cerrado.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open()) this.cerrar();
  }

  enviar() {
    const n = this.nombre.trim();
    if (!n) { this.error.set(this.i18n.t('common.required')); return; }
    this.error.set('');
    this.crear.emit({ nombre: n, link: this.link });
  }
}