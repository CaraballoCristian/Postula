import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Categoria, Template, TIPO_LABELS, TIPO_ICONS, TIPOS_MENSAJE } from '../../models/interfaces';

@Component({
  selector: 'app-editor-templates',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <select [(ngModel)]="filtroCat" (ngModelChange)="loadTemplates()" class="text-sm">
        <option [ngValue]="null">Todas las categorías</option>
        @for (c of categorias; track c.id) {
          <option [ngValue]="c.id">{{ c.nombre }}</option>
        }
      </select>
      <select [(ngModel)]="filtroLang" (ngModelChange)="loadTemplates()" class="text-sm">
        <option [ngValue]="null">Todos los idiomas</option>
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button class="btn btn-primary ml-auto" (click)="openModal()">
        + Nuevo Template
      </button>
    </div>

    @if (templates().length === 0) {
      <div class="card text-center py-8" style="opacity: 0.6;">
        No hay templates para este filtro. Creá uno nuevo.
      </div>
    }

    <div class="space-y-2">
      @for (t of templates(); track t.id; let idx = $index) {
        <div class="card flex items-start gap-3 group">
          <div class="flex flex-col gap-0.5 mr-1">
            <button
              class="btn btn-ghost btn-sm leading-none px-1"
              [disabled]="idx === 0"
              (click)="moveUp(t)"
              title="Subir orden"
              style="font-size: 10px; padding: 0 4px; min-width: 20px;"
            >▲</button>
            <button
              class="btn btn-ghost btn-sm leading-none px-1"
              [disabled]="idx === templates().length - 1"
              (click)="moveDown(t)"
              title="Bajar orden"
              style="font-size: 10px; padding: 0 4px; min-width: 20px;"
            >▼</button>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-sm truncate">{{ t.nombre }}</span>
              <span class="badge" style="background: var(--accent); color: #fff; font-size: 0.65rem;">
                {{ TIPO_ICONS[t.tipo] }} {{ TIPO_LABELS[t.tipo] }}
              </span>
              <span class="badge" style="background: var(--surface-hover); font-size: 0.65rem;">
                {{ t.idioma === 'es' ? 'ES' : 'EN' }}
              </span>
              @if (idx === 0) {
                <span class="text-xs" style="color: var(--accent);">default</span>
              }
            </div>
            <p class="text-xs truncate" style="opacity: 0.5; max-width: 500px;">
              {{ t.contenido.substring(0, 120) }}...
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="btn btn-ghost btn-sm" (click)="openModal(t)">Editar</button>
            <button class="btn btn-ghost btn-sm text-red-400" (click)="deleteTemplate(t.id)">Eliminar</button>
          </div>
        </div>
      }
    </div>

    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4);">
        <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
          <h3 class="text-lg font-semibold mb-4">
            {{ editingId() ? 'Editar Template' : 'Nuevo Template' }}
          </h3>

          <div class="space-y-3">
            <input
              [(ngModel)]="formNombre"
              placeholder="Nombre del template (ej: Template Dev 1)"
              class="w-full"
            />

            <div class="grid grid-cols-3 gap-3">
              <select [(ngModel)]="formCategoriaId">
                <option [ngValue]="null" disabled>-- Categoría --</option>
                @for (c of categorias; track c.id) {
                  <option [ngValue]="c.id">{{ c.nombre }}</option>
                }
              </select>
              <select [(ngModel)]="formIdioma">
                <option [ngValue]="null" disabled>-- Idioma --</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
              <select [(ngModel)]="formTipo">
                <option [ngValue]="null" disabled>-- Tipo --</option>
                @for (t of tipos; track t) {
                  <option [value]="t">{{ TIPO_LABELS[t] }}</option>
                }
              </select>
            </div>

            <div>
              <label class="text-xs mb-1 block" style="opacity: 0.6;">
                Contenido — usá &#123;placeholder&#125; para campos que se reemplazan al generar.
                Los que coincidan con Datos Fijos se rellenan solos.
              </label>
              <textarea
                [(ngModel)]="formContenido"
                (ngModelChange)="updatePlaceholders()"
                rows="10"
                class="w-full font-mono text-sm"
                placeholder="Hola {nombre_reclutador}, vi tu perfil..."
              ></textarea>
            </div>

            @if (detectedPlaceholders().length > 0) {
              <div>
                <span class="text-xs" style="opacity: 0.6;">Placeholders detectados:</span>
                <div class="flex flex-wrap gap-1 mt-1">
                  @for (ph of detectedPlaceholders(); track ph) {
                    <span class="badge" style="background: var(--accent); color: #fff; font-size: 0.7rem;">
                      {{ bra(ph) }}
                    </span>
                  }
                </div>
              </div>
            }
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-outline" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveTemplate()">
              {{ editingId() ? 'Guardar cambios' : 'Crear template' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EditorTemplatesComponent implements OnInit {
  templates = signal<Template[]>([]);
  categorias: Categoria[] = [];
  tipos = TIPOS_MENSAJE;
  TIPO_LABELS = TIPO_LABELS;
  TIPO_ICONS = TIPO_ICONS;

  filtroCat: number | null = null;
  filtroLang: string | null = null;

  modalOpen = signal(false);
  editingId = signal<number | null>(null);

  formNombre = '';
  formCategoriaId: number | null = null;
  formIdioma: string | null = null;
  formTipo: string | null = null;
  formContenido = '';

  detectedPlaceholders = signal<string[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategorias().subscribe(data => this.categorias = data);
    this.loadTemplates();
  }

  loadTemplates() {
    const filters: any = {};
    if (this.filtroCat) filters.categoria_id = this.filtroCat;
    if (this.filtroLang) filters.idioma = this.filtroLang;
    this.api.getTemplates(filters).subscribe(data => {
      this.templates.set(data);
    });
  }

  openModal(t?: Template) {
    if (t) {
      this.editingId.set(t.id);
      this.formNombre = t.nombre;
      this.formCategoriaId = t.categoria_id;
      this.formIdioma = t.idioma;
      this.formTipo = t.tipo;
      this.formContenido = t.contenido;
    } else {
      this.editingId.set(null);
      this.formNombre = '';
      this.formCategoriaId = this.filtroCat || (this.categorias[0]?.id ?? null);
      this.formIdioma = this.filtroLang || 'es';
      this.formTipo = 'email';
      this.formContenido = '';
    }
    this.updatePlaceholders();
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editingId.set(null);
  }

  bra(ph: string) { return '{' + ph + '}'; }

  updatePlaceholders() {
    const matches = this.formContenido.match(/\{(\w+)\}/g);
    if (!matches) {
      this.detectedPlaceholders.set([]);
      return;
    }
    const unique = [...new Set(matches.map(m => m.slice(1, -1)))];
    this.detectedPlaceholders.set(unique);
  }

  saveTemplate() {
    const data: any = {
      nombre: this.formNombre,
      categoria_id: this.formCategoriaId!,
      idioma: this.formIdioma!,
      tipo: this.formTipo!,
      contenido: this.formContenido,
    };

    const id = this.editingId();
    const req = id
      ? this.api.updateTemplate(id, data)
      : this.api.createTemplate(data);

    req.subscribe(() => {
      this.closeModal();
      this.loadTemplates();
    });
  }

  moveUp(t: Template) {
    const idx = this.templates().findIndex(x => x.id === t.id);
    if (idx <= 0) return;
    this.api.reorderTemplate(t.id, idx - 1).subscribe(data => {
      this.templates.set(data);
    });
  }

  moveDown(t: Template) {
    const idx = this.templates().findIndex(x => x.id === t.id);
    if (idx >= this.templates().length - 1) return;
    this.api.reorderTemplate(t.id, idx + 1).subscribe(data => {
      this.templates.set(data);
    });
  }

  deleteTemplate(id: number) {
    if (!confirm('¿Eliminar este template?')) return;
    this.api.deleteTemplate(id).subscribe(() => this.loadTemplates());
  }
}
