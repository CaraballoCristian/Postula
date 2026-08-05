import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ClipboardService } from './services/clipboard.service';
import { ThemeService } from './services/theme.service';
import { SharedStateService } from './services/shared-state.service';
import { I18nService } from './services/i18n.service';
import { AuthService } from './services/auth.service';
import { TabName } from './models/interfaces';
import { LoginComponent } from './components/login/login.component';
import { ConfiguracionComponent } from './components/configuracion/configuracion.component';
import { EditorTemplatesComponent } from './components/editor-templates/editor-templates.component';
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
    NuevaPostulacionComponent,
    HistorialComponent,
    DialogComponent,
  ],
  template: `
    @if (!auth.ready()) {
      <div class="min-h-screen flex items-center justify-center" style="background-color: var(--bg);">
        <div class="flex items-center gap-2 text-sm" style="opacity: 0.55;"><span class="loader"></span> {{ i18n.t('auth.loading') }}</div>
      </div>
    } @else if (!auth.isAuthenticated()) {
      <app-login />
    } @else {
    <div class="min-h-screen" style="background-color: var(--bg);">
      <div class="w-full max-w-5xl mx-auto flex flex-col min-h-[100dvh] sm:min-h-0 sm:my-2 sm:rounded-lg" style="background-color: var(--surface); border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <!-- HEADER -->
        <header class="px-3 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap" style="border-bottom: 1px solid var(--border);">
          <h1 class="flex items-center gap-2 text-base font-semibold tracking-tight select-none">
            <img src="logo.png" alt="Postulá" class="w-6 h-6 rounded-sm" />
            Postulá
          </h1>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <span class="text-xs select-none hidden sm:block" style="opacity: 0.6; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ auth.user()?.email }}</span>
            <button
              class="px-2.5 py-1 text-xs font-medium rounded border-0 cursor-pointer select-none"
              style="background: var(--surface); color: var(--accent);"
              (click)="logout()"
              [title]="i18n.t('auth.logout')"
            >{{ i18n.t('auth.logout') }}</button>
            <span class="w-px h-5" style="background: var(--border);" aria-hidden="true"></span>
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center text-sm border-0 cursor-pointer transition-colors"
              [style.background]="theme.isDark() ? 'var(--surface-hover)' : 'transparent'"
              style="color: var(--text); font-size: 1rem;"
              (click)="theme.isDark.set(!theme.isDark())"
              [title]="i18n.t('theme.toggle')"
            >{{ theme.isDark() ? '☀' : '🌙' }}</button>
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center text-base border-0 cursor-pointer transition-colors"
              style="font-size: 1rem;"
              (click)="colorInput.click()"
              [title]="i18n.t('theme.accent')"
            >🎨</button>
            <input
              #colorInput
              type="color"
              [ngModel]="theme.accentColor()"
              (ngModelChange)="theme.accentColor.set($event)"
              style="position: absolute; width: 0; height: 0; opacity: 0; border: none; padding: 0; margin: 0; overflow: hidden;"
            />
            <span class="w-px h-5" style="background: var(--border);" aria-hidden="true"></span>
            <button
              class="px-2.5 py-1 text-xs font-medium rounded border-0 cursor-pointer select-none"
              style="background: var(--surface); color: var(--accent);"
              [title]="i18n.t('theme.switchLang')"
              (click)="i18n.setLang(i18n.lang() === 'es' ? 'en' : 'es')"
            >{{ i18n.lang() === 'es' ? 'EN' : 'ES' }}</button>
          </div>
        </header>

        <!-- TABS -->
        <nav class="flex px-3 sm:px-6 overflow-x-auto" style="border-bottom: 1px solid var(--border);">
          @for (tab of tabs; track tab.id) {
            <button
              class="relative px-2 sm:px-4 py-2.5 text-sm font-medium cursor-pointer select-none transition-colors bg-transparent border-0 rounded-none whitespace-nowrap"
              [style.color]="shared.activeTab() === tab.id ? 'var(--accent)' : ''"
              [style.opacity]="shared.activeTab() === tab.id ? '1' : '0.55'"
              (click)="shared.activeTab.set(tab.id)"
            >
              {{ i18n.t(tab.labelKey) }}
              @if (shared.activeTab() === tab.id) {
                <span
                  class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200"
                  style="background-color: var(--accent);"
                ></span>
              }
            </button>
          }
        </nav>

        <!-- CONTENT -->
        <main class="flex-1 px-3 sm:px-6 py-5 animate-fade-in">
          <div [class.hidden]="shared.activeTab() !== 'postular'">
            <app-nueva-postulacion />
          </div>
          <div [class.hidden]="shared.activeTab() !== 'historial'">
            <app-historial />
          </div>
          <div [class.hidden]="shared.activeTab() !== 'templates'">
            <app-editor-templates />
          </div>
          <div [class.hidden]="shared.activeTab() !== 'config'">
            <app-configuracion />
          </div>
        </main>
      </div>

      @if (clipboard.copied()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm text-white z-50 animate-slide-up" style="background: var(--accent);">
          {{ i18n.t('clipboard.copied') }}
        </div>
      }

      @if (updateAvailable()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white animate-slide-up" style="background: var(--accent); box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
          <span>{{ i18n.t('pwa.update') }}</span>
          <button
            class="px-2 py-0.5 rounded text-xs font-semibold text-white border-0 cursor-pointer"
            style="background: rgba(255,255,255,0.25);"
            (click)="reloadForUpdate()"
          >{{ i18n.t('pwa.reload') }}</button>
        </div>
      }

      <app-dialog />
    </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .hidden { display: none; }
  `],
})
export class AppComponent {
  tabs: { id: TabName; labelKey: any }[] = [
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
    private swUpdate: SwUpdate,
  ) {
    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') this.updateAvailable.set(true);
    });
  }

  updateAvailable = signal(false);

  async reloadForUpdate() {
    try { await this.swUpdate.activateUpdate(); } catch {}
    window.location.reload();
  }

  logout() {
    this.auth.logout();
    this.shared.activeTab.set('postular');
  }
}