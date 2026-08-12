import { Component, OnInit, signal, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropdownComponent } from '../dropdown/dropdown.component';
import { EmpresaModalComponent } from '../empresa-modal/empresa-modal.component';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { Categoria, Template, TIPO_ICONS, ESTADOS, Idioma, Tag, Empresa } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';
import { labelFromKey as labelFromKeyUtil, stagger as staggerUtil } from '../../utils/utils';
import { DEFAULT_ESTADO, TIPOS_TR } from '../../models/constants';
import { markErrorHandled } from '../../interceptors/error.interceptor';

interface SelectedTemplate {
  tipo: Template['tipo'];
  template: Template | null;
}

@Component({
  selector: 'app-nueva-postulacion',
  standalone: true,
  imports: [FormsModule, DropdownComponent, EmpresaModalComponent],
  templateUrl: './nueva-postulacion.component.html',
})
export class NuevaPostulacionComponent implements OnInit {
  @ViewChild('resultadosSection') resultadosSection!: ElementRef;
  @ViewChild('empresaModal') empresaModal!: EmpresaModalComponent;
  categorias: Categoria[] = [];
  idiomas: Idioma[] = [];
  // Orden visual de los tipos de mensaje en los toggle-pill.
  tipos: Template['tipo'][] = ['mensaje_recruiter', 'email', 'mensaje_empresa'];
  TIPO_ICONS = TIPO_ICONS;
  categoriaId: number | null = null;
  idioma: string | null = null;
  // "Empleado" (mensaje_recruiter) marcado por defecto; loadTemplates completa su plantilla.
  selected = signal<SelectedTemplate[]>([{ tipo: 'mensaje_recruiter', template: null }]);
  fieldValues = signal<Record<string, string>>({});
  dynamicFields = signal<{ key: string; fromConfig: boolean }[]>([]);
  fieldErrors = signal<Set<string>>(new Set());
  resultados = signal<{ tipo: Template['tipo']; texto: string }[]>([]);
  expandedResult = signal<Template['tipo'] | null>(null);
  allTemplates = signal<Template[]>([]);
  loading = signal(false);
  notas = '';
estado = DEFAULT_ESTADO;
  linkEmpresa = '';
  contactoEmpleado = '';
  estados: { value: string; label: string }[] = ESTADOS.map(e => ({ value: e.value, label: e.label }));
  private configKeys: Record<string, string> = {};
  private prevDefaultCat: number | null = null;
  private prevDefaultLang = '';

  // ── Empresas ──
  empresas = signal<Empresa[]>([]);
  selectedEmpresaId: number | null = null;
  empresaLinkOriginal = '';

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
    effect(() => { void shared.empresasRefresh(); if (this.inited) this.loadEmpresas(); });
    effect(() => { void shared.configRefresh(); if (this.inited) this.reloadConfigKeys(); });
  }

  ngOnInit() {
    this.loading.set(true);
    let done = 0;
    const checkDone = () => { if (++done >= 5) this.loading.set(false); };
    this.loadCategorias(checkDone, true);
    this.loadIdiomas(checkDone, true);
    this.loadTags(checkDone);
    this.loadConfig(checkDone, true);
    this.loadEmpresas(checkDone);
    this.inited = true;
  }

  loadEmpresas(onDone?: () => void) {
    this.api.getEmpresas().subscribe(d => {
      this.empresas.set(d);
      onDone?.();
    });
  }

  empresaOpts() { return this.empresas().map(e => ({ value: e.nombre, label: e.nombre })); }

  onEmpresaSelected(nombre: string) {
    const e = this.empresas().find(x => x.nombre === nombre);
    this.setField('empresa', nombre);
    if (e) {
      this.selectedEmpresaId = e.id;
      this.empresaLinkOriginal = e.link;
      this.linkEmpresa = e.link;
    } else {
      this.selectedEmpresaId = null;
      this.empresaLinkOriginal = '';
    }
  }

  openEmpresaModal() { this.empresaModal.abrir(); }

crearEmpresa(data: { nombre: string; link: string }) {
    const nombre = data.nombre.trim();
    const link = data.link.trim();
    this.api.createEmpresa({ nombre, link }).subscribe({
      next: (e) => {
        this.empresas.update(list => [...list, e].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.shared.empresasRefresh.update(v => v + 1);
        this.selectedEmpresaId = e.id;
        this.empresaLinkOriginal = e.link;
        this.linkEmpresa = e.link;
        this.setField('empresa', e.nombre);
        this.empresaModal.cerrar();
      },
      error: (err: any) => {
        if (err?.error?.error === 'EMPRESA_EXISTE') this.dialog.toast(this.i18n.t('np.empresaExiste'), 'error');
        else this.dialog.toast(this.i18n.t('common.error.save'), 'error');
      },
    });
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
        else this.estado = newNames.includes(DEFAULT_ESTADO) ? DEFAULT_ESTADO : (newNames[0] ?? '');
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
      this.prevDefaultCat = defCat;
      this.prevDefaultLang = defLang ?? '';
      if (initial && !this.templatesInitialized && this.categoriaId && this.idioma) { this.templatesInitialized = true; this.loadTemplates(); }
      onDone?.();
    });
  }

  reloadConfigKeys() {
    this.api.getConfig().subscribe(d => {
      this.configKeys = {};
      let defCat: number | null = null;
      let defLang: string | null = null;
      for (const c of d) {
        this.configKeys[c.clave] = c.valor;
        if (c.clave === 'default_categoria_id') defCat = Number(c.valor);
        if (c.clave === 'default_idioma') defLang = c.valor;
      }
      // Re-aplica el default si el usuario no eligió manualmente otra categoría/idioma.
      let catChanged = false;
      let langChanged = false;
      if (defCat && (this.categoriaId === null || this.categoriaId === this.prevDefaultCat)) {
        catChanged = this.categoriaId !== defCat;
        this.categoriaId = defCat;
      }
      if (defLang && (!this.idioma || this.idioma === this.prevDefaultLang)) {
        langChanged = this.idioma !== defLang;
        this.idioma = defLang;
      }
      this.prevDefaultCat = defCat;
      this.prevDefaultLang = defLang ?? '';
      this.buildDynamicFields();
      if ((catChanged || langChanged) && this.categoriaId && this.idioma) this.loadTemplates();
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
    return labelFromKeyUtil(key);
  }

  tipoLabel(tipo: Template['tipo']) { return this.i18n.t(TIPOS_TR[tipo]); }

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

  async guardarPostulacion() {
    const sel = this.selected().filter(s => s.template);
    const vals = this.fieldValues();
    const nombre = vals['empresa'] || '';
    const byTipo: Record<string, string | null> = { email: null, mensaje_empresa: null, mensaje_recruiter: null };
    for (const r of this.resultados()) byTipo[r.tipo] = r.texto;

    if (nombre) {
      if (this.selectedEmpresaId != null) {
        if (this.linkEmpresa !== this.empresaLinkOriginal) {
          const ok = await this.dialog.confirm(this.i18n.t('hist.overwriteLinkMsg', {
            empresa: nombre,
            from: this.empresaLinkOriginal || '—',
            to: this.linkEmpresa || '—',
          }));
          if (!ok) { this.dialog.toast(this.i18n.t('hist.overwriteCanceled')); return; }
          await new Promise<void>(resolve => {
            this.api.updateEmpresa(this.selectedEmpresaId!, { link: this.linkEmpresa }).subscribe({ next: () => resolve(), error: (err) => { markErrorHandled(err); resolve(); } });
          });
          this.shared.empresasRefresh.update(v => v + 1);
        }
      } else {
        await new Promise<void>(resolve => {
          this.api.createEmpresa({ nombre, link: this.linkEmpresa }).subscribe({ next: () => resolve(), error: (err) => { markErrorHandled(err); resolve(); } });
        });
        this.shared.empresasRefresh.update(v => v + 1);
      }
    }

    this.api.createPostulacion({
      empresa: nombre, oferta_laboral: vals['oferta_laboral'] || '', categoria_id: this.categoriaId, idioma: this.idioma,
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
        this.estado = DEFAULT_ESTADO;
        this.linkEmpresa = '';
        this.contactoEmpleado = '';
        this.selectedEmpresaId = null;
        this.empresaLinkOriginal = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => this.dialog.toast(this.i18n.t('np.saveError'), 'error'),
    });
  }

  stagger(i: number): string {
    return staggerUtil(i);
  }
}
