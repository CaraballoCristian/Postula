import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TR } from '../../i18n/es';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4" style="background-color: var(--bg);">
      <div class="w-full max-w-sm card animate-fade-in">
        <div class="text-center mb-6">
          <h1 class="text-xl font-semibold tracking-tight select-none">PostulaTool</h1>
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
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              [attr.autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
              required
            />
          </label>

          @if (mode() === 'register') {
            <label class="flex flex-col gap-1">
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.confirmPassword') }}</span>
              <input
                type="password"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                autocomplete="new-password"
                required
              />
            </label>
            <p class="text-xs" style="opacity: 0.5;">{{ i18n.t('auth.passwordHint') }}</p>
          }

          @if (error()) {
            <p class="text-sm" style="color: #dc2626;">{{ error() }}</p>
          }

          <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
            @if (loading()) {
              <span class="loader" style="border-top-color: #fff;"></span>
            } @else {
              {{ i18n.t(mode() === 'login' ? 'auth.login' : 'auth.create') }}
            }
          </button>
        </form>

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
