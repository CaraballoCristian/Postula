import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [],
  template: `
    <div class="relative">
      <input
        [type]="visible() ? 'text' : 'password'"
        [value]="value"
        (input)="onInput($event)"
        [name]="name"
        [attr.autocomplete]="autocomplete"
        class="w-full pr-10"
        required
      />
      <button
        type="button"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded cursor-pointer border-0"
        style="background: transparent; color: var(--text); opacity: 0.6;"
        (click)="visible.set(!visible())"
        [attr.aria-label]="i18n.t(visible() ? 'common.hidePw' : 'common.showPw')"
        [title]="i18n.t(visible() ? 'common.hidePw' : 'common.showPw')"
      >
        @if (visible()) {
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        } @else {
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        }
      </button>
    </div>
  `,
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