import { Injectable, computed } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { SessionService } from './session.service';
import { I18nService } from './i18n.service';
import { TR } from '../i18n/es';

/** Traduce los códigos de error del backend a una key de i18n. */
const ERROR_KEY: Record<string, TR> = {
  EMAIL_INVALID: 'auth.error.invalidEmail',
  EMAIL_EXISTS: 'auth.error.exists',
  PASSWORD_TOO_SHORT: 'auth.error.shortPassword',
  PASSWORD_TOO_LONG: 'auth.error.longPassword',
  PASSWORD_COMMON: 'auth.error.commonPassword',
  INVALID_CREDENTIALS: 'auth.error.invalid',
  CURRENT_PASSWORD_INCORRECT: 'auth.error.currentPassword',
  PASSWORD_SAME: 'auth.error.samePassword',
  TOO_MANY_ATTEMPTS: 'auth.error.tooMany',
  REGISTER_FAILED: 'auth.error.register',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = computed(() => this.session.token());
  user = computed(() => this.session.user());
  ready = computed(() => this.session.ready());
  isAuthenticated = computed(() => this.session.isAuthenticated());

  constructor(
    private api: ApiService,
    private session: SessionService,
    private i18n: I18nService,
  ) {
    // Validar token guardado contra el server; si expiró, logout silencioso.
    // Se corre en el constructor pero el interceptor inyecta SessionService (no
    // AuthService), por lo que no hay dependencia circular.
    if (session.token()) {
      this.api.me().subscribe({
        next: () => this.session.ready.set(true),
        error: () => {
          this.session.logout();
          this.session.ready.set(true);
        },
        complete: () => this.session.ready.set(true),
      });
    }
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((res) => this.session.setSession(res.token, res.user)));
  }

  register(email: string, password: string) {
    return this.api.register(email, password).pipe(tap((res) => this.session.setSession(res.token, res.user)));
  }

  logout() {
    this.session.logout();
  }

  /** Devuelve el mensaje i18n para el código de error del backend (o null si no es reconocido). */
  errorMessage(err: any): string | null {
    const code = err?.error?.error;
    if (code && ERROR_KEY[code]) return this.i18n.t(ERROR_KEY[code]);
    return null;
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.changePassword(currentPassword, newPassword);
  }
}
