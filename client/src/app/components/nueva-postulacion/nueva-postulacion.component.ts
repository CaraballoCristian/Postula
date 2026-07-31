import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { Categoria, Template, ConfigEntry, TIPO_LABELS, TIPO_ICONS, TIPOS_MENSAJE } from '../../models/interfaces';

interface SelectedTemplate {
  tipo: Template['tipo'];
  template: Template | null;
}

@Component({
  selector: 'app-nueva-postulacion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- FORM -->
      <div>
        <h2 class="text-lg font-semibold mb-4">Nueva Postulación</h2>

        <div class="space-y-4">
          <!-- Paso 1: categoría + idioma -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-medium block mb-1">Categoría</label>
              <select [(ngModel)]="categoriaId" (ngModelChange)="onCategoriaChange()" class="w-full">
                <option [ngValue]="null" disabled>Seleccionar...</option>
                @for (c of categorias; track c.id) {
                  <option [ngValue]="c.id">{{ c.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label class="text-sm font-medium block mb-1">Idioma</label>
              <select [(ngModel)]="idioma" (ngModelChange)="onIdiomaChange()" class="w-full">
                <option [ngValue]="null" disabled>Seleccionar...</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <!-- Paso 2: checkboxes de tipo -->
          @if (categoriaId && idioma) {
            <div>
              <label class="text-sm font-medium block mb-2">¿Qué necesitás generar?</label>
              <div class="flex gap-3">
                @for (tipo of tipos; track tipo) {
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [checked]="isChecked(tipo)"
                      (change)="toggleTipo(tipo)"
                      class="w-4 h-4"
                      style="accent-color: var(--accent);"
                    />
                    <span class="text-sm">{{ TIPO_ICONS[tipo] }} {{ TIPO_LABELS[tipo] }}</span>
                  </label>
                }
              </div>
            </div>
          }

          <!-- Paso 3: dropdown de template por cada tipo tildado -->
          @for (sel of selected(); track sel.tipo) {
            <div>
              <label class="text-sm font-medium block mb-1">{{ TIPO_ICONS[sel.tipo] }} {{ TIPO_LABELS[sel.tipo] }}</label>
              <select [(ngModel)]="sel.template" (ngModelChange)="buildDynamicFields()" class="w-full text-sm">
                <option [ngValue]="null" disabled>Seleccionar template...</option>
                @for (t of templatesByTipo(sel.tipo); track t.id) {
                  <option [ngValue]="t">{{ t.nombre }}</option>
                }
              </select>
            </div>
          }

          <!-- Paso 4: campos dinámicos según placeholders -->
          @if (dynamicFields().length > 0) {
            <div>
              <label class="text-sm font-medium block mb-2">Completá los datos</label>
              <div class="space-y-2">
                @for (field of dynamicFields(); track field.key) {
                  <div>
                    <label class="text-xs block mb-0.5" style="opacity: 0.6;">
                      {{ labelFromKey(field.key) }}
                      @if (field.fromConfig) {
                        <span class="text-xs" style="color: var(--accent);">(de Datos Fijos)</span>
                      }
                    </label>
                    <input
                      [ngModel]="fieldValues()[field.key] || ''"
                      (ngModelChange)="setField(field.key, $event)"
                      class="w-full text-sm"
                      [placeholder]="labelFromKey(field.key)"
                    />
                  </div>
                }
              </div>
            </div>
          }

          <!-- Información adicional para guardar -->
          @if (selected().length > 0 && dynamicFields().length > 0) {
            <div>
              <label class="text-sm font-medium block mb-2">Info para el historial</label>
              <div class="grid grid-cols-2 gap-2">
                <input [(ngModel)]="histEmpresa" placeholder="Empresa" class="text-sm" />
                <input [(ngModel)]="histPuestoOferta" placeholder="Puesto / Oferta" class="text-sm" />
              </div>
            </div>
          }

          <!-- Paso 5: botón generar -->
          @if (selected().length > 0) {
            <button class="btn btn-primary w-full" (click)="generar()">
              Generar mensajes
            </button>
          }
        </div>
      </div>

      <!-- RESULTADOS -->
      <div>
        <h2 class="text-lg font-semibold mb-4">Resultados</h2>

        @if (resultados().length === 0) {
          <div class="card text-center py-8" style="opacity: 0.5;">
            Completá el formulario y hacé clic en "Generar mensajes"
          </div>
        }

        <div class="space-y-3">
          @for (res of resultados(); track res.tipo) {
            <div class="card">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">
                  {{ TIPO_ICONS[res.tipo] }} {{ TIPO_LABELS[res.tipo] }}
                </span>
                <button class="btn btn-outline btn-sm" (click)="clipboard.copy(res.texto)">
                  📋 Copiar
                </button>
              </div>
              <pre class="text-sm whitespace-pre-wrap font-sans" style="line-height: 1.6;">{{ res.texto }}</pre>
            </div>
          }
        </div>

        @if (resultados().length > 0) {
          <div class="flex gap-2 mt-4">
            <button class="btn btn-primary flex-1" (click)="copiarTodo()">
              📋 Copiar todo
            </button>
            <button class="btn btn-outline" (click)="guardarPostulacion()">
              💾 Guardar en historial
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class NuevaPostulacionComponent implements OnInit {
  categorias: Categoria[] = [];
  tipos = TIPOS_MENSAJE;
  TIPO_LABELS = TIPO_LABELS;
  TIPO_ICONS = TIPO_ICONS;

  categoriaId: number | null = null;
  idioma: string | null = null;
  selected = signal<SelectedTemplate[]>([]);
  fieldValues = signal<Record<string, string>>({});
  dynamicFields = signal<{ key: string; fromConfig: boolean }[]>([]);

  histEmpresa = '';
  histPuestoOferta = '';

  resultados = signal<{ tipo: Template['tipo']; texto: string }[]>([]);

  private allTemplates: Template[] = [];
  private configKeys: Record<string, string> = {};

  constructor(
    private api: ApiService,
    public clipboard: ClipboardService,
  ) {}

  ngOnInit() {
    this.api.getCategorias().subscribe(data => this.categorias = data);
    this.api.getConfig().subscribe(data => {
      for (const c of data) {
        this.configKeys[c.clave] = c.valor;
      }
    });
  }

  onCategoriaChange() {
    if (this.categoriaId && this.idioma) {
      this.loadTemplates();
    }
  }

  onIdiomaChange() {
    if (this.categoriaId && this.idioma) {
      this.loadTemplates();
    }
  }

  loadTemplates() {
    this.api.getTemplates({ categoria_id: this.categoriaId!, idioma: this.idioma! }).subscribe(data => {
      this.allTemplates = data;
      this.selected.set([]);
      this.dynamicFields.set([]);
      this.fieldValues.set({});
      this.resultados.set([]);
    });
  }

  templatesByTipo(tipo: Template['tipo']): Template[] {
    return this.allTemplates
      .filter(t => t.tipo === tipo)
      .sort((a, b) => b.orden - a.orden);
  }

  isChecked(tipo: Template['tipo']): boolean {
    return this.selected().some(s => s.tipo === tipo);
  }

  toggleTipo(tipo: Template['tipo']) {
    if (this.isChecked(tipo)) {
      this.selected.update(s => s.filter(x => x.tipo !== tipo));
    } else {
      const defaults = this.templatesByTipo(tipo);
      this.selected.update(s => [...s, { tipo, template: defaults[0] || null }]);
    }
    this.buildDynamicFields();
  }

  setField(key: string, value: string) {
    this.fieldValues.update(v => ({ ...v, [key]: value }));
  }

  labelFromKey(key: string): string {
    return key.replace(/_/g, ' ');
  }

  buildDynamicFields() {
    const sel = this.selected().filter(s => s.template);
    const allPlaceholders = new Set<string>();
    for (const s of sel) {
      const matches = s.template!.contenido.match(/\{(\w+)\}/g);
      if (matches) {
        for (const m of matches) {
          allPlaceholders.add(m.slice(1, -1));
        }
      }
    }

    const fields: { key: string; fromConfig: boolean }[] = [];
    const vals: Record<string, string> = {};
    for (const ph of allPlaceholders) {
      const fromConfig = ph in this.configKeys;
      fields.push({ key: ph, fromConfig });
      vals[ph] = fromConfig ? this.configKeys[ph] : '';
    }
    this.dynamicFields.set(fields);
    this.fieldValues.set(vals);
  }

  generar() {
    const sel = this.selected().filter(s => s.template && s.template!.id);
    const vals = this.fieldValues();
    const results: { tipo: Template['tipo']; texto: string }[] = [];

    for (const s of sel) {
      let texto = s.template!.contenido;
      for (const [key, value] of Object.entries(vals)) {
        texto = texto.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `[${key}]`);
      }
      results.push({ tipo: s.tipo, texto });
    }
    this.resultados.set(results);
  }

  copiarTodo() {
    const all = this.resultados().map(r => r.texto).join('\n\n---\n\n');
    this.clipboard.copy(all);
  }

  guardarPostulacion() {
    const sel = this.selected().filter(s => s.template);
    const templateIds = sel.map(s => s.template!.id);
    const vals = this.fieldValues();

    const byTipo: Record<string, string | null> = { email: null, mensaje_empresa: null, mensaje_recruiter: null };
    for (const r of this.resultados()) {
      byTipo[r.tipo] = r.texto;
    }

    const empresa = this.histEmpresa || vals['empresa'] || '';
    const puestoOferta = this.histPuestoOferta || vals['oferta'] || '';
    const nombreReclutador = vals['nombre_reclutador'] || '';
    const puestoReclutador = vals['puesto_reclutador'] || '';

    this.api.createPostulacion({
      empresa,
      puesto_oferta: puestoOferta,
      categoria_id: this.categoriaId,
      idioma: this.idioma,
      nombre_reclutador: nombreReclutador,
      puesto_reclutador: puestoReclutador,
      template_ids: templateIds,
      valores_usados: vals,
      resultado_email: byTipo['email'],
      resultado_empresa: byTipo['mensaje_empresa'],
      resultado_recruiter: byTipo['mensaje_recruiter'],
    }).subscribe(() => {
      alert('Postulación guardada en el historial.');
    });
  }
}
