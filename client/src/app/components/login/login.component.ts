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
  templateUrl: './login.component.html',
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
