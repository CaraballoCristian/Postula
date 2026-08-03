import { Component, OnInit, signal, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropdownComponent } from '../dropdown/dropdown.component';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { Categoria, Template, TIPO_ICONS, TIPOS_MENSAJE, ESTADOS, Idioma, Tag } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';

interface SelectedTemplate {
  tipo: Template['tipo'];
  template: Template | null;
}

@Component({
  selector: 'app-nueva-postulacion',
  standalone: true,
  imports: [FormsModule, DropdownComponent],
  template: `
    <div class="space-y-4">
      @if (loading()) {
        <div class="card text-center py-6 flex items-center justify-center gap-2" style="opacity: 0.5;">
          <span class="loader"></span> {{ i18n.t('common.loading') }}
        </div>
      } @else {
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          <div class="w-full sm:flex-1" style="max-width: 100%;">
            <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.categoria') }}</label>
            <app-dropdown
              id="postCat"
              [selected]="categoriaId"
              (selectedChange)="categoriaId = $event; onCategoriaChange()"
              [options]="catOpts()"
              [placeholder]="i18n.t('common.select')"
            />
          </div>
          <div class="w-full sm:flex-1" style="max-width: 100%;">
            <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.idioma') }}</label>
            <app-dropdown
              id="postIdioma"
              [selected]="idioma"
              (selectedChange)="idioma = $event; onIdiomaChange()"
              [options]="idiomaOpts()"
              [placeholder]="i18n.t('common.select')"
            />
          </div>
          <div class="hidden sm:block flex-1"></div>
          @if (categoriaId && idioma) {
            @for (tipo of tipos; track tipo) {
              <label class="toggle-pill" [class.active]="isChecked(tipo)" (click)="toggleTipo(tipo)" style="margin-bottom: 1px;">
                <span>{{ TIPO_ICONS[tipo] }}</span>
                <span>{{ tipoLabel(tipo) }}</span>
              </label>
            }
          }
        </div>

        @if (selected().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            @for (sel of selected(); track sel.tipo) {
              <div>
                <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ TIPO_ICONS[sel.tipo] }} {{ tipoLabel(sel.tipo) }}</label>
                <app-dropdown
                  [id]="'tpl-' + sel.tipo"
                  [selected]="sel.template"
                  (selectedChange)="sel.template = $event; buildDynamicFields()"
                  [options]="tplOpts(sel.tipo)"
                  [placeholder]="i18n.t('common.select')"
                />
              </div>
            }
          </div>
        }

        @if (dynamicFields().length > 0) {
          <div class="grid grid-cols-2 gap-x-3 gap-y-2">
            @for (field of dynamicFields(); track field.key) {
              <div>
                <label class="text-xs block mb-1" style="opacity: 0.5;">{{ labelFromKey(field.key) }}</label>
                <input [ngModel]="fieldValues()[field.key] || ''" (ngModelChange)="setField(field.key, $event)" [placeholder]="labelFromKey(field.key)" [style.border-color]="fieldErrors().has(field.key) ? '#ef4444' : ''" />
                @if (fieldErrors().has(field.key)) { <span class="text-xs" style="color: #ef4444;">{{ i18n.t('common.required') }}</span> }
              </div>
            }
          </div>
        }

        @if (selected().length > 0 && dynamicFields().length > 0) {
          <div class="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.estado') }}</label>
              <app-dropdown
                id="postEstado"
                [selected]="estado"
                (selectedChange)="estado = $event"
                [options]="estadoOpts()"
                [placeholder]="i18n.t('common.select')"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.linkEmpresa') }}</label>
              <input [(ngModel)]="linkEmpresa" [placeholder]="i18n.t('np.linkEmpresaPh')" class="text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.contactoEmpleado') }}</label>
              <input [(ngModel)]="contactoEmpleado" [placeholder]="i18n.t('np.contactoEmpleadoPh')" class="text-sm" />
            </div>
            <div class="col-span-2">
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.notas') }}</label>
              <textarea [(ngModel)]="notas" rows="2" class="text-sm" [placeholder]="i18n.t('np.notasPh')"></textarea>
            </div>
          </div>
        }

        @if (selected().length > 0) {
          <button class="btn btn-primary w-full" (click)="generar()">{{ i18n.t('np.generar') }}</button>
        }
      </div>

      @if (resultados().length > 0) {
        <div #resultadosSection class="space-y-1">
          @for (res of resultados(); track res.tipo) {
            <div class="animate-fade-in" style="border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden;">
              <div class="flex items-center gap-3 px-4 py-2.5 cursor-pointer" [style.background-color]="expandedResult() === res.tipo ? 'var(--surface-hover)' : 'var(--surface)'" (click)="toggleResult(res.tipo)">
                <span class="text-sm font-medium flex-1 truncate">{{ TIPO_ICONS[res.tipo] }} {{ tipoLabel(res.tipo) }} <span class="text-xs" style="opacity: 0.35; font-weight: 400;">— {{ previewText(res.texto) }}</span></span>
                <span class="text-xs" style="opacity: 0.4;">{{ expandedResult() === res.tipo ? '▲' : '▼' }}</span>
                <button class="btn btn-ghost btn-sm text-sm" (click)="clipboard.copy(res.texto); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
              </div>
              @if (expandedResult() === res.tipo) {
                <div style="border-top: 1px solid var(--border);"><pre class="text-sm whitespace-pre-wrap font-sans leading-relaxed px-4 py-3" style="margin: 0;">{{ res.texto }}</pre></div>
              }
            </div>
          }
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary flex-1" (click)="copiarTodo()">📋 {{ i18n.t('np.copiarTodo') }}</button>
            <button class="btn btn-outline" (click)="guardarPostulacion()">💾 {{ i18n.t('np.guardar') }}</button>
          </div>
        </div>
      }
      }
    </div>
  `,
})
export class NuevaPostulacionComponent implements OnInit {
  @ViewChild('resultadosSection') resultadosSection!: ElementRef;
  categorias: Categoria[] = [];
  idiomas: Idioma[] = [];
  tipos = TIPOS_MENSAJE;
  TIPO_ICONS = TIPO_ICONS;
  categoriaId: number | null = null;
  idioma: string | null = null;
  selected = signal<SelectedTemplate[]>([]);
  fieldValues = signal<Record<string, string>>({});
  dynamicFields = signal<{ key: string; fromConfig: boolean }[]>([]);
  fieldErrors = signal<Set<string>>(new Set());
  resultados = signal<{ tipo: Template['tipo']; texto: string }[]>([]);
  expandedResult = signal<Template['tipo'] | null>(null);
  allTemplates = signal<Template[]>([]);
  loading = signal(false);
  notas = '';
  estado = 'solicitado';
  linkEmpresa = '';
  contactoEmpleado = '';
  estados: { value: string; label: string }[] = ESTADOS.map(e => ({ value: e.value, label: e.label }));
  private configKeys: Record<string, string> = {};

  private inited = false;
  private templatesInitialized = false;

  constructor(
    private api: ApiService,
    public clipboard: ClipboardService,
    private dialog: DialogService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    effect(() => {
      const refresh = shared.templatesRefresh();
      if (refresh > 0 && this.categoriaId && this.idioma) this.reloadTemplates();
    });
    effect(() => { void shared.tagsRefresh(); if (this.inited) this.loadTags(); });
    effect(() => { void shared.categoriasRefresh(); if (this.inited) this.loadCategorias(); });
    effect(() => { void shared.idiomasRefresh(); if (this.inited) this.loadIdiomas(); });
    effect(() => { void shared.configRefresh(); if (this.inited) this.reloadConfigKeys(); });
  }

  ngOnInit() {
    this.loading.set(true);
    let done = 0;
    const checkDone = () => { if (++done >= 4) this.loading.set(false); };
    this.loadCategorias(checkDone, true);
    this.loadIdiomas(checkDone, true);
    this.loadTags(checkDone);
    this.loadConfig(checkDone, true);
    this.inited = true;
  }

  loadCategorias(onDone?: () => void, initial = false) {
    this.api.getCategorias().subscribe(data => {
      this.categorias = data;
      if (this.categoriaId !== null && !data.some(c => c.id === this.categoriaId)) this.categoriaId = null;
      if (initial && !this.templatesInitialized && this.categoriaId && this.idioma) { this.templatesInitialized = true; this.loadTemplates(); }
      onDone?.();
    });
  }

  loadIdiomas(onDone?: () => void, initial = false) {
    this.api.getIdiomas().subscribe(data => {
      this.idiomas = data;
      if (this.idioma && !data.some(i => i.nombre === this.idioma)) this.idioma = null;
      if (initial && !this.templatesInitialized && this.categoriaId && this.idioma) { this.templatesInitialized = true; this.loadTemplates(); }
      onDone?.();
    });
  }

  loadTags(onDone?: () => void) {
    this.api.getTags().subscribe(data => {
      const prev = this.estados.map(e => e.value);
      this.estados = data.map(t => ({ value: t.nombre, label: this.i18n.tagLabel(t.nombre) }));
      if (data.length === 0) {
        for (const e of ESTADOS) this.estados.push({ value: e.value, label: e.label });
      }
      const newNames = this.estados.map(e => e.value);
      if (!newNames.includes(this.estado)) {
        const added = newNames.filter(x => !prev.includes(x));
        const removed = prev.filter(x => !newNames.includes(x));
        if (removed.length === 1 && added.length === 1 && removed[0] === this.estado) this.estado = added[0];
        else this.estado = newNames.includes('solicitado') ? 'solicitado' : (newNames[0] ?? '');
      }
      onDone?.();
    });
  }

  loadConfig(onDone?: () => void, initial = false) {
    this.api.getConfig().subscribe(d => {
      this.configKeys = {};
      let defCat: number | null = null;
      let defLang: string | null = null;
      for (const c of d) {
        this.configKeys[c.clave] = c.valor;
        if (c.clave === 'default_categoria_id') defCat = Number(c.valor);
        if (c.clave === 'default_idioma') defLang = c.valor;
      }
      if (this.categoriaId === null && defCat) this.categoriaId = defCat;
      if (!this.idioma && defLang) this.idioma = defLang;
      if (initial && !this.templatesInitialized && this.categoriaId && this.idioma) { this.templatesInitialized = true; this.loadTemplates(); }
      onDone?.();
    });
  }

  reloadConfigKeys() {
    this.api.getConfig().subscribe(d => {
      this.configKeys = {};
      for (const c of d) this.configKeys[c.clave] = c.valor;
      this.buildDynamicFields();
    });
  }

  onCategoriaChange() { if (this.categoriaId && this.idioma) this.loadTemplates(); }
  onIdiomaChange() { if (this.categoriaId && this.idioma) this.loadTemplates(); }

  reloadTemplates() {
    this.api.getTemplates({ categoria_id: this.categoriaId!, idioma: this.idioma! }).subscribe(data => {
      this.allTemplates.set(data);
      this.buildDynamicFields();
    });
  }

  loadTemplates() {
    this.api.getTemplates({ categoria_id: this.categoriaId!, idioma: this.idioma! }).subscribe(data => {
      this.allTemplates.set(data);
      this.selected.update(sels => sels.map(s => {
        const defaults = data
          .filter(t => t.tipo === s.tipo)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return { ...s, template: defaults[0] || null };
      }));
      this.buildDynamicFields();
    });
  }

  templatesByTipo(tipo: Template['tipo']) { return this.allTemplates().filter(t => t.tipo === tipo).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  isChecked(tipo: Template['tipo']) { return this.selected().some(s => s.tipo === tipo); }

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
    if (value.trim()) this.fieldErrors.update(e => { const n = new Set(e); n.delete(key); return n; });
  }

  labelFromKey(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  tipoLabel(tipo: Template['tipo']) { return this.i18n.t(`tipo.${tipo}` as any); }

  toggleResult(tipo: Template['tipo']) { this.expandedResult.update(v => v === tipo ? null : tipo); }

  catOpts() { return this.categorias.map(c => ({ value: c.id, label: this.i18n.categoriaLabel(c.nombre) })); }
  idiomaOpts() { return this.idiomas.map(i => ({ value: i.nombre, label: i.nombre })); }
  tplOpts(tipo: Template['tipo']) { return this.templatesByTipo(tipo).map(t => ({ value: t, label: t.nombre })); }
  estadoOpts() { return this.estados.map(e => ({ value: e.value, label: this.i18n.tagLabel(e.value) })); }

  previewText(texto: string): string {
    const flat = texto.replace(/\n/g, ' ').substring(0, 60);
    return flat + (flat.length >= 60 ? '...' : '');
  }

  buildDynamicFields() {
    const sel = this.selected().filter(s => s.template);
    const allPlaceholders = new Set<string>();
    for (const s of sel) {
      const matches = s.template!.contenido.match(/\{(\w+)\}/g);
      if (matches) for (const m of matches) allPlaceholders.add(m.slice(1, -1));
    }
    const fields: { key: string; fromConfig: boolean }[] = [];
    const existing = this.fieldValues();
    const vals: Record<string, string> = {};
    for (const ph of allPlaceholders) {
      fields.push({ key: ph, fromConfig: ph in this.configKeys });
      vals[ph] = existing[ph] ?? this.configKeys[ph] ?? '';
    }
    const core = ['empresa', 'oferta_laboral', 'nombre_empleado', 'puesto_empleado'];
    fields.sort((a, b) => {
      const aTier = core.includes(a.key) ? 0 : (a.fromConfig ? 2 : 1);
      const bTier = core.includes(b.key) ? 0 : (b.fromConfig ? 2 : 1);
      return aTier - bTier;
    });
    this.dynamicFields.set(fields);
    this.fieldValues.set(vals);
    this.fieldErrors.set(new Set());
  }

  generar() {
    const vals = this.fieldValues();
    const errors = new Set<string>();
    for (const f of this.dynamicFields()) { if (!vals[f.key]?.trim()) errors.add(f.key); }
    if (errors.size > 0) { this.fieldErrors.set(errors); return; }

    const sel = this.selected().filter(s => s.template?.id);
    const results: { tipo: Template['tipo']; texto: string }[] = [];
    for (const s of sel) {
      let texto = s.template!.contenido;
      for (const [k, v] of Object.entries(vals)) texto = texto.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '-');
      results.push({ tipo: s.tipo, texto });
    }
    this.resultados.set(results);
    this.fieldErrors.set(new Set());
    this.expandedResult.set(null);
    setTimeout(() => this.resultadosSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  async copiarTodo() {
    const items = this.resultados().map(r => r.texto);
    for (let i = 0; i < items.length; i++) {
      await this.clipboard.copy(items[i]);
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 700));
    }
    this.dialog.toast(this.i18n.t('np.copied', { count: items.length }));
  }

  guardarPostulacion() {
    const sel = this.selected().filter(s => s.template);
    const vals = this.fieldValues();
    const byTipo: Record<string, string | null> = { email: null, mensaje_empresa: null, mensaje_recruiter: null };
    for (const r of this.resultados()) byTipo[r.tipo] = r.texto;
    this.api.createPostulacion({
      empresa: vals['empresa'] || '', oferta_laboral: vals['oferta_laboral'] || '', categoria_id: this.categoriaId, idioma: this.idioma,
      nombre_empleado: vals['nombre_empleado'] || '', puesto_empleado: vals['puesto_empleado'] || '',
      template_ids: sel.map(s => s.template!.id), valores_usados: vals,
      resultado_email: byTipo['email'], resultado_empresa: byTipo['mensaje_empresa'], resultado_recruiter: byTipo['mensaje_recruiter'],
      notas: this.notas, estado: this.estado, link_empresa: this.linkEmpresa, contacto_empleado: this.contactoEmpleado,
    }).subscribe({
      next: () => {
        this.shared.historialRefresh.update(v => v + 1);
        this.dialog.toast(this.i18n.t('np.saved'));
        this.selected.set([]);
        this.dynamicFields.set([]);
        this.fieldValues.set({});
        this.fieldErrors.set(new Set());
        this.resultados.set([]);
        this.expandedResult.set(null);
        this.notas = '';
        this.estado = 'solicitado';
        this.linkEmpresa = '';
        this.contactoEmpleado = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => this.dialog.toast(this.i18n.t('np.saveError')),
    });
  }
}
