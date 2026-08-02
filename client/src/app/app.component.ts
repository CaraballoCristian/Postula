import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClipboardService } from './services/clipboard.service';
import { ThemeService } from './services/theme.service';
import { SharedStateService } from './services/shared-state.service';
import { TabName } from './models/interfaces';
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
    ConfiguracionComponent,
    EditorTemplatesComponent,
    NuevaPostulacionComponent,
    HistorialComponent,
    DialogComponent,
  ],
  template: `
    <div class="min-h-screen" style="background-color: var(--bg);">
      <div class="max-w-5xl mx-auto my-2 rounded-lg flex flex-col" style="background-color: var(--surface); border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <!-- HEADER -->
        <header class="px-6 py-3 flex items-center justify-between" style="border-bottom: 1px solid var(--border);">
          <h1 class="text-base font-semibold tracking-tight select-none">PostulaTool</h1>
          <div class="flex items-center gap-2">
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center text-sm border-0 cursor-pointer transition-colors"
              [style.background]="theme.isDark() ? 'var(--surface-hover)' : 'transparent'"
              style="color: var(--text); font-size: 1rem;"
              (click)="theme.isDark.set(!theme.isDark())"
              title="Modo oscuro / claro"
            >{{ theme.isDark() ? '☀' : '🌙' }}</button>
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center text-base border-0 cursor-pointer transition-colors"
              [style.background]="'transparent'"
              style="font-size: 1rem;"
              (click)="colorInput.click()"
              title="Color acento"
            >🎨</button>
            <input
              #colorInput
              type="color"
              [ngModel]="theme.accentColor()"
              (ngModelChange)="theme.accentColor.set($event)"
              style="position: absolute; width: 0; height: 0; opacity: 0; border: none; padding: 0; margin: 0; overflow: hidden;"
            />
          </div>
        </header>

        <!-- TABS -->
        <nav class="flex px-6" style="border-bottom: 1px solid var(--border);">
          @for (tab of tabs; track tab.id) {
            <button
              class="relative px-4 py-2.5 text-sm font-medium cursor-pointer select-none transition-colors bg-transparent border-0 rounded-none"
              [style.color]="shared.activeTab() === tab.id ? 'var(--accent)' : ''"
              [style.opacity]="shared.activeTab() === tab.id ? '1' : '0.55'"
              (click)="shared.activeTab.set(tab.id)"
            >
              {{ tab.label }}
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
        <main class="flex-1 px-6 py-5 animate-fade-in">
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
          Copiado al portapapeles
        </div>
      }

      <app-dialog />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hidden { display: none; }
  `],
})
export class AppComponent {
  tabs: { id: TabName; label: string }[] = [
    { id: 'postular', label: 'Nueva Postulación' },
    { id: 'historial', label: 'Historial' },
    { id: 'templates', label: 'Templates' },
    { id: 'config', label: 'Configuración' },
  ];

  constructor(
    public clipboard: ClipboardService,
    public theme: ThemeService,
    public shared: SharedStateService,
  ) {}
}
