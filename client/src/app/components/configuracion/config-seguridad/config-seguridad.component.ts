import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { I18nService } from '../../../services/i18n.service';
import { PasswordFieldComponent } from '../../password-field/password-field.component';
import { markErrorHandled } from '../../../interceptors/error.interceptor';

@Component({
  selector: 'app-config-seguridad',
  standalone: true,
  imports: [FormsModule, PasswordFieldComponent],
  templateUrl: './config-seguridad.component.html',
})
export class ConfigSeguridadComponent {
  formCurrentPassword = '';
  formNewPassword = '';
  formConfirmPassword = '';
  pwLoading = signal(false);
  pwMsg = signal('');
  pwOk = signal(false);

  constructor(
    private auth: AuthService,
    public i18n: I18nService,
  ) {}

  changePassword() {
    if (this.pwLoading()) return;
    this.pwMsg.set('');
    this.pwOk.set(false);

    const current = this.formCurrentPassword;
    const next = this.formNewPassword;
    const confirm = this.formConfirmPassword;

    if (!current || !next) {
      this.pwMsg.set(this.i18n.t('auth.error.required'));
      return;
    }
    if (next.length < 8) {
      this.pwMsg.set(this.i18n.t('auth.error.shortPassword'));
      return;
    }
    if (next.length > 72) {
      this.pwMsg.set(this.i18n.t('auth.error.longPassword'));
      return;
    }
    if (COMMON_PASSWORDS.has(next.toLowerCase())) {
      this.pwMsg.set(this.i18n.t('auth.error.commonPassword'));
      return;
    }
    if (next !== confirm) {
      this.pwMsg.set(this.i18n.t('auth.error.passwordMismatch'));
      return;
    }

    this.pwLoading.set(true);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwOk.set(true);
        this.pwMsg.set(this.i18n.t('auth.passwordChanged'));
        this.formCurrentPassword = '';
        this.formNewPassword = '';
        this.formConfirmPassword = '';
      },
      error: (err) => {
        markErrorHandled(err);
        this.pwLoading.set(false);
        const msg = this.auth.errorMessage(err);
        this.pwMsg.set(msg ?? this.i18n.t('common.error.save'));
      },
    });
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