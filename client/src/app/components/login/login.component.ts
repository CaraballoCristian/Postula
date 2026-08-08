import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TR } from '../../i18n/es';
import { PasswordFieldComponent } from '../password-field/password-field.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, PasswordFieldComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4" style="background-color: var(--bg);">
      <div class="w-full max-w-sm card animate-fade-in">
        <div class="text-center mb-6">
          <h1 class="text-xl font-semibold tracking-tight select-none">Postulá</h1>
          <p class="text-sm mt-1" style="opacity: 0.55;">{{ i18n.t('auth.hint') }}</p>
        </div>

        <form (ngSubmit)="submit()" class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.email') }}</span>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              autocomplete="email"
              required
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.password') }}</span>
            <app-password-field
              [value]="password"
              (valueChange)="password = $event"
              name="password"
              [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
            />
          </label>

          @if (mode() === 'register') {
            <label class="flex flex-col gap-1">
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.confirmPassword') }}</span>
              <app-password-field
                [value]="confirmPassword"
                (valueChange)="confirmPassword = $event"
                name="confirmPassword"
                autocomplete="new-password"
              />
            </label>
            <p class="text-xs" style="opacity: 0.5;">{{ i18n.t('auth.passwordHint') }}</p>
          }

          @if (error()) {
            <p class="text-sm" style="color: #dc2626;">{{ error() }}</p>
          }

          <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
            @if (loading()) {
              <span class="loader" style="border-top-color: var(--accent-contrast, #fff);"></span>
            } @else {
              {{ i18n.t(mode() === 'login' ? 'auth.login' : 'auth.create') }}
            }
          </button>
        </form>

        <div class="flex items-center gap-2 my-3" style="opacity: 0.5;">
          <span class="flex-1" style="height: 1px; background: var(--border);"></span>
          <span class="text-xs">o</span>
          <span class="flex-1" style="height: 1px; background: var(--border);"></span>
        </div>

        <button
          type="button"
          class="btn btn-ghost w-full cursor-pointer border rounded-md flex items-center justify-center gap-2"
          style="background: var(--surface); color: var(--text);"
          (click)="googleLogin()"
          [disabled]="loading()"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {{ i18n.t('auth.google') }}
        </button>

        <div class="text-center mt-4">
          <button
            type="button"
            class="text-sm cursor-pointer bg-transparent border-0"
            style="color: var(--accent);"
            (click)="toggleMode()"
            [disabled]="loading()"
          >{{ i18n.t(mode() === 'login' ? 'auth.switchToRegister' : 'auth.switchToLogin') }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  confirmPassword = '';
  mode = signal<'login' | 'register'>('login');
  loading = signal(false);
  error = signal('');

  constructor(
    private auth: AuthService,
    public i18n: I18nService,
  ) {}

  toggleMode() {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.error.set('');
  }

  googleLogin() {
    window.location.href = '/api/auth/google';
  }

  submit() {
    if (this.loading()) return;
    this.error.set('');

    const email = this.email.trim().toLowerCase();
    if (!email || !this.password) {
      this.error.set(this.i18n.t('auth.error.invalid'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set(this.i18n.t('auth.error.invalidEmail'));
      return;
    }
    if (this.mode() === 'register') {
      const passErr = this.validatePassword(this.password);
      if (passErr) {
        this.error.set(this.i18n.t(passErr));
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error.set(this.i18n.t('auth.error.passwordMismatch'));
        return;
      }
    }

    this.loading.set(true);
    const call = this.mode() === 'login'
      ? this.auth.login(email, this.password)
      : this.auth.register(email, this.password);

    call.subscribe({
      next: () => {
        // El logout resetea el error; el estado de sesión lo maneja AppComponent.
      },
      error: (err) => {
        this.loading.set(false);
        const msg = this.auth.errorMessage(err);
        if (msg) {
          this.error.set(msg);
        } else if (err?.status === 401 || err?.status === 400) {
          this.error.set(this.i18n.t('auth.error.invalid'));
        } else {
          this.error.set(this.i18n.t('auth.error.register'));
        }
      },
    });
  }

  private validatePassword(pass: string): TR | null {
    if (pass.length < 8) return 'auth.error.shortPassword';
    if (pass.length > 72) return 'auth.error.longPassword';
    if (COMMON_PASSWORDS.has(pass.toLowerCase())) return 'auth.error.commonPassword';
    return null;
  }
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'qwerty', 'qwerty123', 'abc123', 'abc12345',
  'letmein', 'welcome', 'admin', 'admin123', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'master', 'login', 'princess',
  'football', 'baseball', 'sunshine', 'charlie', 'trustno1', 'shadow',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  '123123', '123qwe', '111111', '000000', '654321', '666666', '888888', '999999',
]);
