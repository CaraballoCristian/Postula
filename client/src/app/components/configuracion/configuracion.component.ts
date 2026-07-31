import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { ConfigEntry } from '../../models/interfaces';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 class="text-lg font-semibold mb-4">Datos Fijos</h2>
        <p class="text-sm mb-4" style="opacity: 0.6;">
          Estos valores se rellenan automáticamente al generar mensajes si el template usa su placeholder.
          Por ejemplo: un template con &#123;mi_nombre&#125; toma el valor que configures aquí.
        </p>

        <div class="space-y-2">
          @for (entry of entries(); track entry.id) {
            <div class="card flex items-center gap-3">
              <input
                class="flex-1 text-sm font-mono"
                [ngModel]="entry.clave"
                (ngModelChange)="updateEntry(entry.id, $event, entry.valor)"
                placeholder="clave"
              />
              <input
                class="flex-1 text-sm"
                [ngModel]="entry.valor"
                (ngModelChange)="updateEntry(entry.id, entry.clave, $event)"
                placeholder="valor"
              />
              <button class="btn btn-ghost btn-sm text-red-400" (click)="deleteEntry(entry.id)">×</button>
            </div>
          }
        </div>

        <button class="btn btn-outline mt-3 w-full" (click)="addEntry()">
          + Agregar campo
        </button>
      </div>

      <div>
        <h2 class="text-lg font-semibold mb-4">Apariencia</h2>

        <div class="card space-y-4">
          <div>
            <label class="text-sm font-medium block mb-1">Color acento</label>
            <div class="flex items-center gap-3">
              <input
                type="color"
                [ngModel]="theme.accentColor()"
                (ngModelChange)="theme.accentColor.set($event)"
                class="w-10 h-10 rounded cursor-pointer border-0 p-0"
              />
              <span class="text-sm font-mono">{{ theme.accentColor() }}</span>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium block mb-1">Modo oscuro</label>
            <button
              class="btn"
              [class.btn-primary]="theme.isDark()"
              [class.btn-outline]="!theme.isDark()"
              (click)="theme.isDark.set(!theme.isDark())"
            >
              {{ theme.isDark() ? '🌙 Oscuro' : '☀️ Claro' }}
            </button>
          </div>

          <div>
            <label class="text-sm font-medium block mb-2">Vista previa</label>
            <div class="card space-y-2" style="border-width: 2px; border-color: var(--accent);">
              <div class="flex gap-2">
                <span class="btn btn-primary btn-sm">Primario</span>
                <span class="btn btn-outline btn-sm">Secundario</span>
                <span class="btn btn-ghost btn-sm">Ghost</span>
              </div>
              <input class="w-full text-sm" placeholder="Input de ejemplo" value="Texto" />
              <div class="flex gap-2">
                <span class="badge" style="background:var(--accent); color:#fff;">Badge</span>
                <span class="badge" style="background:var(--surface-hover);">Tag</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ConfiguracionComponent implements OnInit {
  entries = signal<ConfigEntry[]>([]);

  constructor(
    private api: ApiService,
    public theme: ThemeService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getConfig().subscribe(data => this.entries.set(data));
  }

  updateEntry(id: number, clave: string, valor: string) {
    this.api.updateConfig(id, { clave, valor }).subscribe();
  }

  addEntry() {
    this.api.createConfig('nuevo_campo', '').subscribe(entry => {
      this.entries.update(e => [...e, entry]);
    });
  }

  deleteEntry(id: number) {
    this.api.deleteConfig(id).subscribe(() => {
      this.entries.update(e => e.filter(x => x.id !== id));
    });
  }
}
