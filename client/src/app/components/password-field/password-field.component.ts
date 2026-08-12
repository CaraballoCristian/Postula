import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [],
  templateUrl: './password-field.component.html',
  styles: [`
    :host { display: block; }
  `],
})
export class PasswordFieldComponent {
  @Input() value = '';
  @Input() name = '';
  @Input() autocomplete = '';
  @Output() valueChange = new EventEmitter<string>();
  visible = signal(false);

  constructor(public i18n: I18nService) {}

  onInput(e: Event) {
    this.valueChange.emit((e.target as HTMLInputElement).value);
  }
}