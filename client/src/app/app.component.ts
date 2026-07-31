import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClipboardService } from './services/clipboard.service';
import { ConfiguracionComponent } from './components/configuracion/configuracion.component';
import { EditorTemplatesComponent } from './components/editor-templates/editor-templates.component';
import { NuevaPostulacionComponent } from './components/nueva-postulacion/nueva-postulacion.component';
import { HistorialComponent } from './components/historial/historial.component';

type Tab = 'postular' | 'historial' | 'templates' | 'config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ConfiguracionComponent,
    EditorTemplatesComponent,
    NuevaPostulacionComponent,
    HistorialComponent,
  ],
  template: `
    <div class="min-h-screen flex flex-col" style="background-color: var(--bg); color: var(--text);">
      <header class="border-b" style="border-color: var(--border);">
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 class="text-lg font-bold tracking-tight">PostulaTool</h1>
          <div class="tab-bar" style="border-bottom: none;">
            @for (tab of tabs; track tab.id) {
              <button
                class="tab-item"
                [class.active]="activeTab() === tab.id"
                (click)="activeTab.set(tab.id)"
              >
                {{ tab.label }}
              </button>
            }
          </div>
          <div class="w-20"></div>
        </div>
      </header>

      <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        @switch (activeTab()) {
          @case ('postular') {
            <app-nueva-postulacion />
          }
          @case ('historial') {
            <app-historial />
          }
          @case ('templates') {
            <app-editor-templates />
          }
          @case ('config') {
            <app-configuracion />
          }
        }
      </main>

      @if (clipboard.copied()) {
        <div class="copied-tooltip">Copiado al portapapeles</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class AppComponent {
  activeTab = signal<Tab>('postular');
  tabs: { id: Tab; label: string }[] = [
    { id: 'postular', label: 'Nueva Postulación' },
    { id: 'historial', label: 'Historial' },
    { id: 'templates', label: 'Templates' },
    { id: 'config', label: 'Configuración' },
  ];

  constructor(public clipboard: ClipboardService) {}
}
