import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ClipboardService } from './services/clipboard.service';
import { ThemeService } from './services/theme.service';
import { SharedStateService } from './services/shared-state.service';
import { I18nService } from './services/i18n.service';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { DialogService } from './services/dialog.service';
import { TabName } from './models/interfaces';
import { LoginComponent } from './components/login/login.component';
import { ConfiguracionComponent } from './components/configuracion/configuracion.component';
import { EditorTemplatesComponent } from './components/editor-templates/editor-templates.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { NuevaPostulacionComponent } from './components/nueva-postulacion/nueva-postulacion.component';
import { HistorialComponent } from './components/historial/historial.component';
import { DialogComponent } from './components/dialog/dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    LoginComponent,
    ConfiguracionComponent,
    EditorTemplatesComponent,
    DashboardComponent,
    NuevaPostulacionComponent,
    HistorialComponent,
    DialogComponent,
  ],
  templateUrl: './app.component.html',
  styles: [`
    :host { display: block; }
    .hidden { display: none; }
  `],
})
export class AppComponent {
  tabs: { id: TabName; labelKey: any }[] = [
    { id: 'dashboard', labelKey: 'tab.dashboard' },
    { id: 'postular', labelKey: 'tab.postular' },
    { id: 'historial', labelKey: 'tab.historial' },
    { id: 'templates', labelKey: 'tab.templates' },
    { id: 'config', labelKey: 'tab.config' },
  ];

  constructor(
    public clipboard: ClipboardService,
    public theme: ThemeService,
    public shared: SharedStateService,
    public i18n: I18nService,
    public auth: AuthService,
    private session: SessionService,
    private dialog: DialogService,
    private swUpdate: SwUpdate,
  ) {
    if (this.isPwaStandalone()) {
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') this.updateAvailable.set(true);
      });
    }
    this.handleOAuthReturn();
  }

  /** El aviso de nueva versión solo aplica a la PWA instalada (standalone), no a la web en pestaña. */
  private isPwaStandalone(): boolean {
    return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  }

  /** Captura el token devuelto por el callback de Google OAuth y limpia la URL. */
  private handleOAuthReturn() {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const oauthEmail = params.get('oauth_email');
    const oauthId = params.get('oauth_id');

    if (oauthToken && oauthEmail) {
      this.session.setSession(oauthToken, { id: Number(oauthId), email: oauthEmail, created_at: '' });
      this.cleanOAuthParams();
    } else if (params.get('oauth_error')) {
      this.cleanOAuthParams();
      setTimeout(() => this.dialog.toast(this.i18n.t('auth.oauthError'), 'error'), 0);
    }
  }

  private cleanOAuthParams() {
    try {
      const clean = window.location.pathname;
      history.replaceState({}, document.title, clean);
    } catch { /* el token ya se guardó en sesión; si falla la limpieza no es crítico */ }
  }

  updateAvailable = signal(false);

  async reloadForUpdate() {
    try { await this.swUpdate.activateUpdate(); } catch {}
    window.location.reload();
  }

  logout() {
    this.auth.logout();
    this.shared.activeTab.set('dashboard');
  }

  toggleLayout() {
    this.theme.layoutMode.set(this.theme.layoutMode() === 'full' ? 'framed' : 'full');
  }
}