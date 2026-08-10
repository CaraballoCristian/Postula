import { Component, signal, effect, HostListener } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DropdownComponent } from "../dropdown/dropdown.component";
import { ApiService } from "../../services/api.service";
import { DialogService } from "../../services/dialog.service";
import { SharedStateService } from "../../services/shared-state.service";
import {
  Categoria,
  Template,
  TIPO_ICONS,
  TIPOS_MENSAJE,
  Idioma,
} from "../../models/interfaces";
import { I18nService } from "../../services/i18n.service";
import { bra as braUtil, stagger as staggerUtil } from "../../utils/utils";
import { BackdropDismissDirective } from "../../directives/backdrop-dismiss.directive";

@Component({
  selector: "app-editor-templates",
  standalone: true,
  imports: [FormsModule, DropdownComponent, BackdropDismissDirective],
  templateUrl: './editor-templates.component.html',
})
export class EditorTemplatesComponent {
  templates = signal<Template[]>([]);
  categorias: Categoria[] = [];
  idiomas: Idioma[] = [];
  configKeys: string[] = [];
  tipos = TIPOS_MENSAJE;
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
    public i18n: I18nService,
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

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.modalOpen()) this.closeModal();
  }

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
    return braUtil(ph);
  }

  joinPlaceholders(): string {
    return this.detectedPlaceholders()
      .map((p) => this.bra(p))
      .join(", ");
  }

  filtroResumen(): string {
    const parts: string[] = [];
    if (this.filtroCat != null) {
      const c = this.categorias.find(x => x.id === this.filtroCat);
      if (c) parts.push(this.i18n.categoriaLabel(c.nombre));
    }
    if (this.filtroLang) parts.push(this.filtroLang);
    return parts.join(' / ');
  }

  catFilterOpts() {
    return [
      { value: null, label: this.i18n.t('tpl.todas') },
      ...this.categorias.map((c) => ({ value: c.id, label: this.i18n.categoriaLabel(c.nombre) })),
    ];
  }
  idiomaFilterOpts() {
    return [
      { value: null, label: this.i18n.t('tpl.todos') },
      ...this.idiomas.map((i) => ({ value: i.nombre, label: i.nombre })),
    ];
  }
  catOpts() {
    return this.categorias.map((c) => ({ value: c.id, label: this.i18n.categoriaLabel(c.nombre) }));
  }
  idiomaOpts() {
    return this.idiomas.map((i) => ({ value: i.nombre, label: i.nombre }));
  }
  tipoOpts() {
    return this.tipos.map((t) => ({ value: t, label: this.tipoLabel(t) }));
  }
  tipoLabel(tipo: Template['tipo']) { return this.i18n.t(`tipo.${tipo}` as any); }

  saveTemplate() {
    this.nombreError.set('');
    this.contenidoError.set('');

    if (!this.formNombre.trim()) { this.nombreError.set(this.i18n.t('tpl.nombreError')); return; }
    if (!/\{empresa\}/.test(this.formContenido)) { this.contenidoError.set(this.i18n.t('tpl.contenidoError')); return; }

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
    const ok = await this.dialog.confirm(this.i18n.t('tpl.deleteConfirm'));
    if (!ok) return;
    this.api.deleteTemplate(id).subscribe(() => {
      this.loadTemplates();
      this.shared.templatesRefresh.update((v) => v + 1);
    });
  }

  stagger(i: number): string {
    return staggerUtil(i);
  }
}
