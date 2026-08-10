import { Component, signal, computed, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { ConfigEntry, Categoria, Idioma, Tag, Postulacion } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';
import { DEFAULT_TAG_LABELS, DEFAULT_CAT_LABELS } from '../../i18n/labels';
import { firstValueFrom } from 'rxjs';
import { PasswordFieldComponent } from '../password-field/password-field.component';
import { ImportConflictComponent, ImportConflictGroup, ImportChoice } from '../import-conflict/import-conflict.component';
import { BackdropDismissDirective } from '../../directives/backdrop-dismiss.directive';
import { bra as braUtil, slugify as slugifyUtil, stagger as staggerUtil } from '../../utils/utils';

type ConfigSection = 'datos' | 'categorias' | 'idiomas' | 'tags' | 'backup' | 'seguridad';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule, PasswordFieldComponent, ImportConflictComponent, BackdropDismissDirective],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent {
  private readonly RESERVED_KEYS = ['default_categoria_id', 'default_idioma'];
  entries = signal<ConfigEntry[]>([]);
  userEntries = computed(() => this.entries().filter(e => !this.RESERVED_KEYS.includes(e.clave)));
  categorias = signal<Categoria[]>([]);
  idiomas = signal<Idioma[]>([]);
  loaded = signal(false);
  loading = signal(false);

  activeSection = signal<ConfigSection>('datos');
  sections: { id: ConfigSection; labelKey: any }[] = [
    { id: 'datos', labelKey: 'cfg.section.datos' },
    { id: 'categorias', labelKey: 'cfg.section.categorias' },
    { id: 'idiomas', labelKey: 'cfg.section.idiomas' },
    { id: 'tags', labelKey: 'cfg.section.tags' },
    { id: 'backup', labelKey: 'backup.section' },
    { id: 'seguridad', labelKey: 'auth.section.security' },
  ];

  private allTemplates: any[] = [];
  private oldClave = '';
  private oldCatNombre = '';
  defaultCategoriaId: number | null = null;
  defaultIdiomaNombre = '';
  tags = signal<Tag[]>([]);

  claveError = signal('');
  catNombreError = signal('');
  idiomaNombreError = signal('');
  tagNombreError = signal('');

  modalDatos = signal(false); editDatoId = signal<number | null>(null); formDatoClave = ''; formDatoValor = '';
  modalCat = signal(false); editCatId = signal<number | null>(null); formCatNombre = '';
  modalIdioma = signal(false); editIdiomaId = signal<number | null>(null); formIdiomaNombre = '';
  modalTag = signal(false); editTagId = signal<number | null>(null); formTagNombre = ''; formTagColor = '#3b82f6';
  reassignModal = signal<'tag' | 'categoria' | null>(null); pendingDeleteKind: 'tag' | 'categoria' | null = null; pendingDeleteId: number | null = null; pendingDeleteCount = 0; reassignDestId: number | null = null;
  importReview = signal<{ data: any; groups: ImportConflictGroup[] } | null>(null);
  importBusy = signal(false);

  formCurrentPassword = '';
  formNewPassword = '';
  formConfirmPassword = '';
  pwLoading = signal(false);
  pwMsg = signal('');
  pwOk = signal(false);

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private dialog: DialogService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    effect(() => {
      if (this.shared.activeTab() === 'config' && !this.loaded()) {
        this.initData();
        this.loaded.set(true);
      }
    });
    effect(() => { void shared.templatesRefresh(); if (this.loaded()) this.reloadAllTemplates(); });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.importReview()) { this.cancelImport(); return; }
    if (this.reassignModal()) { this.cancelReassign(); return; }
    if (this.modalDatos() || this.modalCat() || this.modalIdioma() || this.modalTag()) this.closeModals();
  }

  reloadAllTemplates() { this.api.getTemplates().subscribe(d => this.allTemplates = d); }

  initData() {
    this.loading.set(true);
    let done = 0;
    const check = () => { if (++done >= 4) this.loading.set(false); };
    this.api.getConfig().subscribe(d => {
      this.entries.set(d);
      const catDef = d.find(e => e.clave === 'default_categoria_id');
      if (catDef) this.defaultCategoriaId = Number(catDef.valor);
      const langDef = d.find(e => e.clave === 'default_idioma');
      if (langDef) this.defaultIdiomaNombre = langDef.valor;
      check();
    });
    this.api.getCategorias().subscribe(d => { this.categorias.set(d); check(); });
    this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); check(); });
    this.api.getTags().subscribe(d => { this.tags.set(d); check(); });
    this.api.getTemplates().subscribe(d => this.allTemplates = d);
  }

  closeModals() { this.modalDatos.set(false); this.editDatoId.set(null); this.modalCat.set(false); this.editCatId.set(null); this.modalIdioma.set(false); this.editIdiomaId.set(null); this.modalTag.set(false); this.editTagId.set(null); this.reassignModal.set(null); this.pendingDeleteId = null; this.reassignDestId = null; this.claveError.set(''); this.catNombreError.set(''); this.idiomaNombreError.set(''); this.tagNombreError.set(''); }

  refCount(clave: string): number {
    let c = 0; const r = new RegExp(`\\{${clave}\\}`, 'g');
    for (const t of this.allTemplates) if (r.test(t.contenido)) c++;
    return c;
  }

  bra(s: string) { return braUtil(s); }

  catRefCount(id: number): number { return this.allTemplates.filter((t: any) => t.categoria_id === id).length; }
  idiomaRefCount(nombre: string): number { return this.allTemplates.filter((t: any) => t.idioma === nombre).length; }

  ALL_IDIOMAS = ['ARA', 'CHI', 'DEU', 'ENG', 'ESP', 'FRA', 'HIN', 'ITA', 'JPN', 'KOR', 'POR', 'RUS'];
  availableIdiomas = signal(this.ALL_IDIOMAS);

  updateAvailableIdiomas() {
    const used = new Set(this.idiomas().map(i => i.nombre));
    this.availableIdiomas.set(this.ALL_IDIOMAS.filter(l => !used.has(l)));
  }

  // ── DATOS PERSONALES ──
  openDatosModal(e?: ConfigEntry) {
    this.claveError.set('');
    if (e) { this.editDatoId.set(e.id); this.formDatoClave = e.clave; this.formDatoValor = e.valor; this.oldClave = e.clave; }
    else { this.editDatoId.set(null); this.formDatoClave = ''; this.formDatoValor = ''; this.oldClave = ''; }
    this.modalDatos.set(true);
  }

  async saveDato() {
    const clave = this.formDatoClave.trim(); const valor = this.formDatoValor;
    if (!clave) { this.claveError.set(this.i18n.t('cfg.claveVacia')); return; }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(clave)) { this.claveError.set(this.i18n.t('cfg.claveInvalida')); return; }
    this.claveError.set('');
    const id = this.editDatoId();
    if (id && this.oldClave && clave !== this.oldClave) {
      const affected = this.allTemplates.filter((t: any) => new RegExp(`\\{${this.oldClave}\\}`, 'g').test(t.contenido));
      if (affected.length > 0) {
        const ok = await this.dialog.confirm(this.i18n.t('cfg.renameClave', { old: `{${this.oldClave}}`, new: `{${clave}}`, count: affected.length }));
        if (!ok) return;
        for (const t of affected) { this.api.updateTemplate(t.id, { contenido: t.contenido.replace(new RegExp(`\\{${this.oldClave}\\}`, 'g'), `{${clave}}`) }).subscribe(); }
        this.api.getTemplates().subscribe(d => this.allTemplates = d);
      }
    }

    if (id && this.oldClave === clave) {
      const oldValor = this.entries().find(e => e.id === id)?.valor ?? '';
      if (valor !== oldValor) {
        const confirmed = await this.propagateValor(clave, valor);
        if (!confirmed) return;
      }
    }

    const req = id ? this.api.updateConfig(id, { clave, valor }) : this.api.createConfig(clave, valor);
    req.subscribe(() => { this.shared.configRefresh.update(v => v + 1); this.closeModals(); this.api.getConfig().subscribe(d => this.entries.set(d)); });
  }

  private renderTemplate(contenido: string, values: Record<string, string>): string {
    return contenido.replace(/\{(\w+)\}/g, (_m, k) => values[k] ?? '-');
  }

  /** Propaga un cambio de valor de variable personal a las publicaciones que la usan y re-renderiza sus mensajes. */
  private async propagateValor(clave: string, nuevoValor: string): Promise<boolean> {
    const list = await new Promise<Postulacion[]>(resolve => this.api.getPostulaciones().subscribe(resolve));
    const afectadas = list.filter(p => p.valores_usados && Object.prototype.hasOwnProperty.call(p.valores_usados, clave));
    if (afectadas.length === 0) return true;
    const ok = await this.dialog.confirm(this.i18n.t('cfg.propDato', { clave, count: afectadas.length }));
    if (!ok) return false;
    const tplMap = new Map<number, any>();
    for (const t of this.allTemplates as any[]) tplMap.set(t.id, t);
    let done = 0;
    for (const p of afectadas) {
      const values: Record<string, string> = { ...p.valores_usados, [clave]: nuevoValor };
      let email: string | null = null;
      let empresaMsg: string | null = null;
      let recruiter: string | null = null;
      for (const tid of (p.template_ids || [])) {
        const t = tplMap.get(tid);
        if (!t) continue;
        const texto = this.renderTemplate(t.contenido, values);
        if (t.tipo === 'email') email = texto;
        else if (t.tipo === 'mensaje_empresa') empresaMsg = texto;
        else recruiter = texto;
      }
      await new Promise<void>(r => this.api.updatePostulacion(p.id, {
        resultado_email: email, resultado_empresa: empresaMsg, resultado_recruiter: recruiter, valores_usados: values,
      }).subscribe({ next: () => r(), error: () => r() }));
      done++;
    }
    if (done > 0) this.dialog.toast(this.i18n.t('cfg.propDatoDone', { count: done }));
    return true;
  }

  async removeDato(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delVariable'));
    if (!ok) return;
    this.api.deleteConfig(id).subscribe(() => { this.shared.configRefresh.update(v => v + 1); this.api.getConfig().subscribe(d => this.entries.set(d)); });
  }

  // ── CATEGORÍAS ──
  openCatModal(c?: Categoria) {
    this.editCatId.set(c ? c.id : null);
    this.oldCatNombre = c ? c.nombre : '';
    this.formCatNombre = c ? this.i18n.categoriaLabel(c.nombre) : '';
    this.catNombreError.set('');
    this.modalCat.set(true);
  }
  async setDefaultCategoria(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.defaultCategoriaConfirm'));
    if (!ok) return;
    this.api.setDefaultCategoria(id).subscribe(() => { this.defaultCategoriaId = id; this.shared.configRefresh.update(v => v + 1); });
  }

  async setDefaultIdioma(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.defaultIdiomaConfirm'));
    if (!ok) return;
    this.api.setDefaultIdioma(id).subscribe(() => {
      const idioma = this.idiomas().find(i => i.id === id);
      if (idioma) this.defaultIdiomaNombre = idioma.nombre;
      this.shared.configRefresh.update(v => v + 1);
    });
  }

  async saveCategoria() {
    const n = this.formCatNombre.trim(); if (!n) { this.catNombreError.set(this.i18n.t('cfg.nombreRequerido')); return; }
    this.catNombreError.set('');
    const id = this.editCatId();
    if (this.categorias().some(c => c.id !== id && this.catCollides(c, n))) { this.catNombreError.set(this.i18n.t('cfg.categoriaExiste')); return; }
    const old = id ? this.categorias().find(c => c.id === id) : undefined;
    if (id && old && n !== old.nombre && this.i18n.categoriaLabel(n) === this.i18n.categoriaLabel(old.nombre)) {
      // Mismo label traducido (p. ej. "Management" → "Gestión" en ES): no renombra, conserva el original.
      this.api.updateCategoria(id, old.nombre).subscribe({ next: () => { this.closeModals(); this.api.getCategorias().subscribe(d => this.categorias.set(d)); this.shared.categoriasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.categoriaExiste', 'common.error.save') });
      return;
    }
    if (id && old && n !== old.nombre) {
      // Renombre real: confirmar si hay postulaciones que usan la categoría.
      const oldL = this.i18n.categoriaLabel(old.nombre);
      const newL = this.i18n.categoriaLabel(n);
      const affected = await new Promise<number>(resolve => {
        this.api.getPostulaciones({ categoria_id: id }).subscribe(list => resolve(list.length));
      });
      const ok = await this.dialog.confirm(affected > 0
        ? this.i18n.t('cfg.renameCat', { old: oldL, new: newL, count: affected })
        : this.i18n.t('cfg.renameCatSimple', { old: oldL, new: newL }));
      if (!ok) return;
    }
    (id ? this.api.updateCategoria(id, n) : this.api.createCategoria(n)).subscribe({ next: () => { this.closeModals(); this.api.getCategorias().subscribe(d => this.categorias.set(d)); this.shared.categoriasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.categoriaExiste', 'common.error.save') });
  }
  async removeCategoria(id: number) {
    const cat = this.categorias().find(c => c.id === id);
    if (!cat) return;
    const affected = await new Promise<number>(resolve => {
      this.api.getPostulaciones({ categoria_id: id }).subscribe(list => resolve(list.length));
    });
    this.pendingDeleteKind = 'categoria';
    this.pendingDeleteId = id;
    this.pendingDeleteCount = affected;
    if (affected === 0) {
      const ok = await this.dialog.confirm(this.i18n.t('cfg.delCategoria'));
      if (!ok) return;
      this.deleteCurrent();
      return;
    }
    const others = this.categorias().filter(c => c.id !== id);
    if (others.length === 0) {
      this.dialog.toast(this.i18n.t('cfg.sinOtrasCategorias'), 'error');
      this.cancelReassign();
      return;
    }
    this.reassignDestId = others[0].id;
    this.reassignModal.set('categoria');
  }

  // ── IDIOMAS ──
  openIdiomaModal(i?: Idioma) { this.editIdiomaId.set(i ? i.id : null); this.formIdiomaNombre = i ? i.nombre : ''; this.idiomaNombreError.set(''); this.modalIdioma.set(true); }
  saveIdioma() {
    const n = this.formIdiomaNombre.trim(); if (!n) { this.idiomaNombreError.set(this.i18n.t('cfg.nombreRequerido')); return; }
    this.idiomaNombreError.set('');
    const id = this.editIdiomaId();
    (id ? this.api.updateIdioma(id, n) : this.api.createIdioma(n)).subscribe({ next: () => { this.closeModals(); this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); }); this.shared.idiomasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.idiomaExiste', 'common.error.save') });
  }
  async removeIdioma(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delIdioma'));
    if (!ok) return;
    this.api.deleteIdioma(id).subscribe(() => { this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); }); this.shared.idiomasRefresh.update(v => v + 1); });
  }

  // ── BACKUP ──
  async exportBackup() {
    const data = await firstValueFrom(this.api.exportBackup()) as any;
    if (data == null) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const suggestedName = `postulatool-backup-${Date.now()}.json`;

    // File System Access API: abre SIEMPRE el diálogo nativo para elegir dónde/con qué nombre (Chrome/Edge inclusive la PWA).
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === 'function') {
      try {
        const handle = await picker.call(window, { suggestedName, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.dialog.toast(this.i18n.t('backup.exportDone'));
        return;
      } catch (err: any) {
        // Cancelación del diálogo o error no bloqueante: no mostrar toast de error.
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback (Firefox/Safari): descarga directa a la carpeta de descargas.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.dialog.toast(this.i18n.t('backup.exportDone'));
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        const ok = await this.dialog.confirm(this.i18n.t('backup.importConfirm'));
        if (!ok) { input.value = ''; return; }
        this.api.importPreview(data).subscribe({
          next: (res) => {
const groups = (res?.groups ?? []) as ImportConflictGroup[];
      const conflicted = groups.some(g => g.conflictLink || g.conflictMensaje || (g.postConflicts?.length ?? 0) > 0);
            if (!conflicted) {
              this.doImport(data, {});
            } else {
              this.importReview.set({ data, groups });
            }
          },
          error: (err) => { console.error('[backup] import preview error', err?.message, err?.status); this.dialog.toast(this.i18n.t('backup.importError'), 'error'); },
        });
      } catch {
        this.dialog.toast(this.i18n.t('backup.importError'), 'error');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  cancelImport() {
    this.importReview.set(null);
    this.importBusy.set(false);
  }

  confirmImport(choices: Record<string, ImportChoice>) {
    const review = this.importReview();
    if (!review) return;
    this.doImport(review.data, choices);
  }

  doImport(data: any, decisions: Record<string, ImportChoice>) {
    this.importBusy.set(true);
    this.api.importBackup(data, decisions).subscribe({
      next: () => {
        this.importBusy.set(false);
        this.importReview.set(null);
        this.dialog.toast(this.i18n.t('backup.importDone'));
        this.shared.configRefresh.update(v => v + 1);
        this.shared.categoriasRefresh.update(v => v + 1);
        this.shared.idiomasRefresh.update(v => v + 1);
        this.shared.tagsRefresh.update(v => v + 1);
        this.shared.templatesRefresh.update(v => v + 1);
        this.shared.historialRefresh.update(v => v + 1);
        this.shared.empresasRefresh.update(v => v + 1);
        this.initData();
      },
      error: (err: any) => {
        console.error('[backup] import preview/import error', err?.message, err?.status);
        this.importBusy.set(false);
        this.dialog.toast(this.i18n.t('backup.importError'), 'error');
      },
    });
  }

  // ── TAGS ──
  slugify(name: string) { return slugifyUtil(name); }
  private errorToast(err: any, dupKey: any, fallbackKey: any) {
    if (err?.status === 409) this.dialog.toast(this.i18n.t(dupKey), 'error');
    else this.dialog.toast(this.i18n.t(fallbackKey), 'error');
  }
  private catLabels(nombre: string): string[] {
    const d = DEFAULT_CAT_LABELS[nombre];
    return d ? [d.es, d.en] : [this.i18n.categoriaLabel(nombre)];
  }
  private catCollides(existing: Categoria, candidate: string): boolean {
    const c = candidate.trim();
    if (!c) return false;
    const cLower = c.toLowerCase();
    if (existing.nombre.trim().toLowerCase() === cLower) return true;
    return this.catLabels(existing.nombre).some(l => l.toLowerCase() === cLower);
  }
  private tagLabels(nombre: string): string[] {
    return DEFAULT_TAG_LABELS[nombre]
      ? [DEFAULT_TAG_LABELS[nombre].es, DEFAULT_TAG_LABELS[nombre].en]
      : [this.i18n.tagLabel(nombre)];
  }
  private tagCollides(existing: Tag, candidateLabel: string): boolean {
    const c = candidateLabel.trim();
    if (!c) return false;
    const cLower = c.toLowerCase();
    if (this.slugify(existing.nombre) === this.slugify(c)) return true;
    return this.tagLabels(existing.nombre).some(l => l.toLowerCase() === cLower);
  }
  openTagModal(t?: Tag) {
    this.editTagId.set(t ? t.id : null);
    this.formTagNombre = t ? this.i18n.tagLabel(t.nombre) : '';
    this.formTagColor = t ? t.color : '#3b82f6';
    this.tagNombreError.set('');
    this.modalTag.set(true);
  }
  async saveTag() {
    const n = this.slugify(this.formTagNombre); if (!n) { this.tagNombreError.set(this.i18n.t('cfg.nombreRequerido')); return; }
    this.tagNombreError.set('');
    const id = this.editTagId();
    if (this.tags().some(t => t.id !== id && this.tagCollides(t, this.formTagNombre))) { this.tagNombreError.set(this.i18n.t('cfg.tagExiste')); return; }
    if (id) {
      const old = this.tags().find(t => t.id === id);
      if (old && n !== old.nombre) {
        const sameLabel = this.i18n.tagLabel(n) === this.i18n.tagLabel(old.nombre);
        if (sameLabel) {
          // El usuario re-escribió el mismo label traducido: solo actualiza color, no renombra.
          this.api.updateTag(id, { nombre: old.nombre, color: this.formTagColor })
            .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
          return;
        }
        const affected = await new Promise<number>(resolve => {
          this.api.getPostulaciones().subscribe(list => resolve(list.filter(p => p.estado === old.nombre).length));
        });
        const oldL = this.i18n.tagLabel(old.nombre);
        const newL = this.i18n.tagLabel(n);
        const msg = affected > 0
          ? this.i18n.t('cfg.renameTag', { old: oldL, new: newL, count: affected })
          : this.i18n.t('cfg.renameTagSimple', { old: oldL, new: newL });
        const ok = await this.dialog.confirm(msg);
        if (!ok) return;
        this.api.updateTag(id, { nombre: n, color: this.formTagColor, propagate: true })
          .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.historialRefresh.update(v => v + 1); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
        return;
      }
    }
    (id ? this.api.updateTag(id, { nombre: n, color: this.formTagColor }) : this.api.createTag(n, this.formTagColor))
      .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
  }
  async removeTag(id: number) {
    const tag = this.tags().find(t => t.id === id);
    if (!tag) return;
    const affected = await new Promise<number>(resolve => {
      this.api.getPostulaciones().subscribe(list => resolve(list.filter(p => p.estado === tag.nombre).length));
    });
    this.pendingDeleteKind = 'tag';
    this.pendingDeleteId = id;
    this.pendingDeleteCount = affected;
    if (affected === 0) {
      const ok = await this.dialog.confirm(this.i18n.t('cfg.deleteTagSimple', { tag: this.i18n.tagLabel(tag.nombre) }));
      if (!ok) return;
      this.deleteCurrent();
      return;
    }
    const others = this.tags().filter(t => t.id !== id);
    if (others.length === 0) {
      this.dialog.toast(this.i18n.t('cfg.sinOtrasEtiquetas'), 'error');
      this.cancelReassign();
      return;
    }
    this.reassignDestId = others[0].id;
    this.reassignModal.set('tag');
  }

  pendingDeleteName() {
    const id = this.pendingDeleteId;
    if (id == null) return '';
    if (this.pendingDeleteKind === 'categoria') return this.categorias().find(c => c.id === id)?.nombre ?? '';
    return this.tags().find(t => t.id === id)?.nombre ?? '';
  }

  reassignDestOptions() {
    const kind = this.pendingDeleteKind;
    const list = kind === 'categoria' ? this.categorias() : this.tags();
    return list.filter(x => x.id !== this.pendingDeleteId).map(x => ({
      id: x.id,
      label: kind === 'categoria' ? this.i18n.categoriaLabel(x.nombre) : this.i18n.tagLabel(x.nombre),
    }));
  }

  cancelReassign() {
    this.reassignModal.set(null);
    this.pendingDeleteKind = null;
    this.pendingDeleteId = null;
    this.pendingDeleteCount = 0;
    this.reassignDestId = null;
  }

  private deleteRequest(id: number, dest?: number) {
    return this.pendingDeleteKind === 'categoria'
      ? this.api.deleteCategoria(id, dest)
      : this.api.deleteTag(id, dest);
  }

  private refreshAfterDelete() {
    this.api.getTags().subscribe(d => this.tags.set(d));
    this.api.getCategorias().subscribe(d => this.categorias.set(d));
    this.shared.tagsRefresh.update(v => v + 1);
    this.shared.categoriasRefresh.update(v => v + 1);
    this.shared.historialRefresh.update(v => v + 1);
    this.shared.templatesRefresh.update(v => v + 1);
  }

  deleteCurrent() {
    const id = this.pendingDeleteId;
    if (id === null) { this.dialog.toast(this.i18n.t('common.error.delete'), 'error'); return; }
    this.deleteRequest(id).subscribe({
      next: () => {
        this.cancelReassign();
        this.refreshAfterDelete();
      },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }

  confirmReassign() {
    const id = this.pendingDeleteId;
    if (id === null || this.reassignDestId === null) { this.dialog.toast(this.i18n.t('cfg.elegiDestino'), 'error'); return; }
    this.deleteRequest(id, this.reassignDestId).subscribe({
      next: () => {
        this.cancelReassign();
        this.refreshAfterDelete();
      },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }

  // ── CAMBIAR CONTRASEÑA ──
  changePassword() {
    if (this.pwLoading()) return;
    this.pwMsg.set('');
    this.pwOk.set(false);

    const current = this.formCurrentPassword;
    const next = this.formNewPassword;
    const confirm = this.formConfirmPassword;

    if (!current || !next) {
      this.pwMsg.set(this.i18n.t('auth.error.required'));
      return;
    }
    if (next.length < 8) {
      this.pwMsg.set(this.i18n.t('auth.error.shortPassword'));
      return;
    }
    if (next.length > 72) {
      this.pwMsg.set(this.i18n.t('auth.error.longPassword'));
      return;
    }
    if (COMMON_PASSWORDS.has(next.toLowerCase())) {
      this.pwMsg.set(this.i18n.t('auth.error.commonPassword'));
      return;
    }
    if (next !== confirm) {
      this.pwMsg.set(this.i18n.t('auth.error.passwordMismatch'));
      return;
    }

    this.pwLoading.set(true);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwOk.set(true);
        this.pwMsg.set(this.i18n.t('auth.passwordChanged'));
        this.formCurrentPassword = '';
        this.formNewPassword = '';
        this.formConfirmPassword = '';
      },
      error: (err) => {
        this.pwLoading.set(false);
        const msg = this.auth.errorMessage(err);
        this.pwMsg.set(msg ?? this.i18n.t('common.error.save'));
      },
    });
  }

  stagger(i: number): string {
    return staggerUtil(i);
  }
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'qwerty', 'qwerty123', 'abc123', 'abc12345',
  'letmein', 'welcome', 'admin', 'admin123', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'master', 'login', 'princess',
  'football', 'baseball', 'sunshine', 'charlie', 'trustno1', 'shadow',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  '123123', '123qwe', '111111', '000000', '654321', '666666', '888888', '999999',
]);
