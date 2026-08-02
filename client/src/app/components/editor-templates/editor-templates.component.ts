import { Component, OnInit, signal, effect } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DropdownComponent } from "../dropdown/dropdown.component";
import { ApiService } from "../../services/api.service";
import { DialogService } from "../../services/dialog.service";
import { SharedStateService } from "../../services/shared-state.service";
import {
  Categoria,
  Template,
  TIPO_LABELS,
  TIPO_ICONS,
  TIPOS_MENSAJE,
  Idioma,
} from "../../models/interfaces";

@Component({
  selector: "app-editor-templates",
  standalone: true,
  imports: [FormsModule, DropdownComponent],
  template: `
    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
      <app-dropdown
        id="filtroCat"
        class="sm:w-1/6 "
        [selected]="filtroCat"
        (selectedChange)="filtroCat = $event; loadTemplates()"
        [options]="catFilterOpts()"
        placeholder="Categorías"
      />
      <app-dropdown
        id="filtroLang"
        class="sm:w-1/6"
        [selected]="filtroLang"
        (selectedChange)="filtroLang = $event; loadTemplates()"
        [options]="idiomaFilterOpts()"
        placeholder="Idiomas"
      />
      <button
        class="btn btn-primary w-full sm:w-auto sm:ml-auto"
        (click)="openModal()"
      >
        + Nuevo Template
      </button>
    </div>

    @if (loading()) {
      <div
        class="card text-center py-12 flex items-center justify-center gap-2"
        style="opacity: 0.5;"
      >
        <span class="loader"></span> Cargando...
      </div>
    } @else if (templates().length === 0) {
      <div class="card text-center py-12" style="opacity: 0.35;">
        No hay templates para este filtro.
      </div>
    }

    <div class="space-y-1">
      @for (t of templates(); track t.id) {
        <div class="card flex items-center gap-3 animate-fade-in">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-medium text-sm truncate">{{ t.nombre }}</span>
              <span
                class="badge text-[0.65rem]"
                style="background: var(--accent); color: #fff;"
                >{{ TIPO_ICONS[t.tipo] }} {{ TIPO_LABELS[t.tipo] }}</span
              >
              <span
                class="badge text-[0.65rem]"
                style="background: var(--surface-hover);"
                >{{ t.idioma }}</span
              >
            </div>
            <p class="text-xs truncate" style="opacity: 0.4; max-width: 500px;">
              {{ t.contenido.substring(0, 100) }}...
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button
              class="btn btn-ghost btn-sm"
              (click)="openModal(t)"
              title="Editar"
            >
              ✏️
            </button>
            <button
              class="btn btn-ghost btn-sm"
              (click)="deleteTemplate(t.id)"
              title="Eliminar"
            >
              🗑️
            </button>
          </div>
        </div>
      }
    </div>

    @if (modalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]"
        style="background: rgba(0,0,0,0.35);"
        (click)="closeModal()"
      >
        <div
          class="card w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 animate-fade-in"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-base font-semibold mb-4">
            {{ editingId() ? "Editar Template" : "Nuevo Template" }}
          </h3>
          <div class="space-y-3">
            <input [(ngModel)]="formNombre" placeholder="Nombre del template" [style.border-color]="nombreError() ? '#ef4444' : ''" (ngModelChange)="nombreError.set('')" />
            @if (nombreError()) { <span class="text-xs" style="color: #ef4444;">{{ nombreError() }}</span> }
            <div class="grid grid-cols-3 gap-3">
              <app-dropdown
                id="formCat"
                [selected]="formCategoriaId"
                (selectedChange)="formCategoriaId = $event"
                [options]="catOpts()"
                placeholder="Categoría"
              />
              <app-dropdown
                id="formIdioma"
                [selected]="formIdioma"
                (selectedChange)="formIdioma = $event"
                [options]="idiomaOpts()"
                placeholder="Idioma"
              />
              <app-dropdown
                id="formTipo"
                [selected]="formTipo"
                (selectedChange)="formTipo = $event"
                [options]="tipoOpts()"
                placeholder="Tipo"
              />
            </div>

            <div>
              <label class="text-xs mb-1 block" style="opacity: 0.45;"
                >Click en un chip para insertar el placeholder en el
                cursor</label
              >
              <div class="flex flex-wrap gap-1 mb-2">
                @for (ph of availablePlaceholders(); track ph) {
                  <button
                    class="badge text-[0.7rem] cursor-pointer border-0 transition-opacity"
                    style="background: var(--surface-hover); color: var(--text);"
                    (click)="insertPlaceholder(ph)"
                  >
                    {{ bra(ph) }}
                  </button>
                }
              </div>
              <textarea
                #ta
                [(ngModel)]="formContenido"
                (ngModelChange)="updatePlaceholders(); contenidoError.set('')"
                rows="9"
                class="font-mono text-sm"
                [style.border-color]="contenidoError() ? '#ef4444' : ''"
                placeholder="Hola {nombre_empleado}, vi tu perfil..."
              ></textarea>
              @if (contenidoError()) { <span class="text-xs" style="color: #ef4444;">{{ contenidoError() }}</span> }
            </div>

            @if (detectedPlaceholders().length > 0) {
              <div class="text-xs" style="opacity: 0.4;">
                Placeholders usados: {{ joinPlaceholders() }}
              </div>
            }
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeModal()">
              Cancelar
            </button>
            <button class="btn btn-primary" (click)="saveTemplate()">
              {{ editingId() ? "Guardar" : "Crear" }}
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
  idiomas: Idioma[] = [];
  configKeys: string[] = [];
  tipos = TIPOS_MENSAJE;
  TIPO_LABELS = TIPO_LABELS;
  TIPO_ICONS = TIPO_ICONS;
  filtroCat: number | null = null;
  filtroLang: string | null = null;
  modalOpen = signal(false);
  editingId = signal<number | null>(null);
  formNombre = "";
  formCategoriaId: number | null = null;
  formIdioma: string | null = null;
  formTipo: string | null = null;
  formContenido = "";
  detectedPlaceholders = signal<string[]>([]);
  loaded = signal(false);
  loading = signal(false);
  nombreError = signal('');
  contenidoError = signal('');

  private inited = false;

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
  ) {
    effect(() => {
      if (this.shared.activeTab() === "templates" && !this.loaded()) {
        this.initData();
        this.loaded.set(true);
      }
    });
    effect(() => { void shared.categoriasRefresh(); if (this.inited) this.reloadCategorias(); });
    effect(() => { void shared.idiomasRefresh(); if (this.inited) this.reloadIdiomas(); });
    effect(() => { void shared.configRefresh(); if (this.inited) this.reloadConfigKeys(); });
  }

  ngOnInit() {}

  initData() {
    this.loading.set(true);
    let done = 0;
    const checkDone = () => {
      if (++done >= 4) this.loading.set(false);
    };
    this.api.getCategorias().subscribe((data) => {
      this.categorias = data;
      checkDone();
    });
    this.api.getIdiomas().subscribe((data) => {
      this.idiomas = data;
      checkDone();
    });
    this.api.getConfig().subscribe((data) => {
      this.configKeys = data.filter(c => !['default_categoria_id', 'default_idioma'].includes(c.clave)).map(c => c.clave);
      checkDone();
    });
    this.api.getTemplates({}).subscribe((data) => {
      this.templates.set(data);
      checkDone();
    });
    this.inited = true;
  }

  reloadCategorias() {
    this.api.getCategorias().subscribe((data) => {
      this.categorias = data;
      if (this.filtroCat && !data.some(c => c.id === this.filtroCat)) this.filtroCat = null;
      if (this.formCategoriaId && !data.some(c => c.id === this.formCategoriaId)) this.formCategoriaId = data[0]?.id ?? null;
    });
  }

  reloadIdiomas() {
    this.api.getIdiomas().subscribe((data) => {
      this.idiomas = data;
      if (this.filtroLang && !data.some(i => i.nombre === this.filtroLang)) this.filtroLang = null;
      if (this.formIdioma && !data.some(i => i.nombre === this.formIdioma)) this.formIdioma = data[0]?.nombre ?? null;
    });
  }

  reloadConfigKeys() {
    this.api.getConfig().subscribe((data) => {
      this.configKeys = data.filter(c => !['default_categoria_id', 'default_idioma'].includes(c.clave)).map(c => c.clave);
    });
  }

  loadTemplates() {
    const filters: any = {};
    if (this.filtroCat) filters.categoria_id = this.filtroCat;
    if (this.filtroLang) filters.idioma = this.filtroLang;
    this.api
      .getTemplates(filters)
      .subscribe((data) => this.templates.set(data));
  }

  availablePlaceholders(): string[] {
    const hardcoded = [
      "nombre_empleado",
      "puesto_empleado",
      "empresa",
      "oferta_laboral",
    ];
    const all = new Set([...hardcoded, ...this.configKeys]);
    return [...all].sort();
  }

  insertPlaceholder(ph: string) {
    const ta = document.querySelector(
      "textarea.font-mono",
    ) as HTMLTextAreaElement;
    if (!ta) {
      this.formContenido += "{" + ph + "}";
      this.updatePlaceholders();
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = this.formContenido;
    this.formContenido =
      text.substring(0, start) + "{" + ph + "}" + text.substring(end);
    this.updatePlaceholders();
    setTimeout(() => {
      ta.focus();
      const pos = start + ph.length + 2;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  openModal(t?: Template) {
    this.nombreError.set('');
    this.contenidoError.set('');
    if (t) {
      this.editingId.set(t.id);
      this.formNombre = t.nombre;
      this.formCategoriaId = t.categoria_id;
      this.formIdioma = t.idioma;
      this.formTipo = t.tipo;
      this.formContenido = t.contenido;
    } else {
      this.editingId.set(null);
      this.formNombre = "";
      this.formCategoriaId = this.filtroCat || (this.categorias[0]?.id ?? null);
      this.formIdioma = this.filtroLang || (this.idiomas[0]?.nombre ?? "ESP");
      this.formTipo = "email";
      this.formContenido = "";
    }
    this.updatePlaceholders();
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editingId.set(null);
  }

  updatePlaceholders() {
    const matches = this.formContenido.match(/\{(\w+)\}/g);
    if (!matches) {
      this.detectedPlaceholders.set([]);
      return;
    }
    this.detectedPlaceholders.set([
      ...new Set(matches.map((m) => m.slice(1, -1))),
    ]);
  }

  bra(ph: string) {
    return "{" + ph + "}";
  }

  joinPlaceholders(): string {
    return this.detectedPlaceholders()
      .map((p) => this.bra(p))
      .join(", ");
  }

  catFilterOpts() {
    return [
      { value: null, label: "Todas" },
      ...this.categorias.map((c) => ({ value: c.id, label: c.nombre })),
    ];
  }
  idiomaFilterOpts() {
    return [
      { value: null, label: "Todos" },
      ...this.idiomas.map((i) => ({ value: i.nombre, label: i.nombre })),
    ];
  }
  catOpts() {
    return this.categorias.map((c) => ({ value: c.id, label: c.nombre }));
  }
  idiomaOpts() {
    return this.idiomas.map((i) => ({ value: i.nombre, label: i.nombre }));
  }
  tipoOpts() {
    return this.tipos.map((t) => ({ value: t, label: TIPO_LABELS[t] }));
  }

  saveTemplate() {
    this.nombreError.set('');
    this.contenidoError.set('');

    if (!this.formNombre.trim()) { this.nombreError.set('El nombre es requerido'); return; }
    if (!/\{empresa\}/.test(this.formContenido)) { this.contenidoError.set('Debe incluir {empresa}'); return; }

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
      this.shared.templatesRefresh.update((v) => v + 1);
    });
  }

  async deleteTemplate(id: number) {
    const ok = await this.dialog.confirm("¿Eliminar este template?");
    if (!ok) return;
    this.api.deleteTemplate(id).subscribe(() => {
      this.loadTemplates();
      this.shared.templatesRefresh.update((v) => v + 1);
    });
  }
}
