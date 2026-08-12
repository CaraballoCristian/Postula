import { Component, signal, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { DialogService } from '../../../services/dialog.service';
import { SharedStateService } from '../../../services/shared-state.service';
import { Categoria } from '../../../models/interfaces';
import { I18nService } from '../../../services/i18n.service';
import { TemplatesCacheService } from '../../../services/templates-cache.service';
import { DEFAULT_CAT_LABELS } from '../../../i18n/labels';
import { BackdropDismissDirective } from '../../../directives/backdrop-dismiss.directive';
import { stagger as staggerUtil } from '../../../utils/utils';
import { markErrorHandled } from '../../../interceptors/error.interceptor';

@Component({
  selector: 'app-config-categorias',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './config-categorias.component.html',
})
export class ConfigCategoriasComponent {
  categorias = signal<Categoria[]>([]);
  loading = signal(false);
  defaultCategoriaId: number | null = null;
  private oldCatNombre = '';

  catNombreError = signal('');
  modalCat = signal(false);
  editCatId = signal<number | null>(null);
  formCatNombre = '';

  reassignModal = signal(false);
  pendingDeleteId: number | null = null;
  pendingDeleteCount = 0;
  reassignDestId: number | null = null;

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
    private cache: TemplatesCacheService,
    public i18n: I18nService,
  ) {
    effect(() => { void this.shared.categoriasRefresh(); this.load(); });
    effect(() => { void this.shared.configRefresh(); this.load(); });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.reassignModal()) { this.cancelReassign(); return; }
    if (this.modalCat()) this.closeModals();
  }

  load() {
    this.loading.set(true);
    this.api.getCategorias().subscribe(d => { this.categorias.set(d); this.loading.set(false); });
    this.api.getConfig().subscribe(d => {
      const catDef = d.find(e => e.clave === 'default_categoria_id');
      if (catDef) this.defaultCategoriaId = Number(catDef.valor);
    });
    this.cache.load();
  }

  closeModals() { this.modalCat.set(false); this.editCatId.set(null); this.catNombreError.set(''); }

  stagger(i: number): string { return staggerUtil(i); }

  catRefCount(id: number): number { return this.cache.items().filter((t: any) => t.categoria_id === id).length; }

  private errorToast(err: any, dupKey: any, fallbackKey: any) {
    markErrorHandled(err);
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

  async saveCategoria() {
    const n = this.formCatNombre.trim(); if (!n) { this.catNombreError.set(this.i18n.t('cfg.nombreRequerido')); return; }
    this.catNombreError.set('');
    const id = this.editCatId();
    if (this.categorias().some(c => c.id !== id && this.catCollides(c, n))) { this.catNombreError.set(this.i18n.t('cfg.categoriaExiste')); return; }
    const old = id ? this.categorias().find(c => c.id === id) : undefined;
    if (id && old && n !== old.nombre && this.i18n.categoriaLabel(n) === this.i18n.categoriaLabel(old.nombre)) {
      // Mismo label traducido (p. ej. "Management" → "Gestión" en ES): no renombra, conserva el original.
      this.api.updateCategoria(id, old.nombre).subscribe({ next: () => { this.closeModals(); this.shared.categoriasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.categoriaExiste', 'common.error.save') });
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
    (id ? this.api.updateCategoria(id, n) : this.api.createCategoria(n)).subscribe({ next: () => { this.closeModals(); this.shared.categoriasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.categoriaExiste', 'common.error.save') });
  }

  async removeCategoria(id: number) {
    const cat = this.categorias().find(c => c.id === id);
    if (!cat) return;
    const affected = await new Promise<number>(resolve => {
      this.api.getPostulaciones({ categoria_id: id }).subscribe(list => resolve(list.length));
    });
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
    this.reassignModal.set(true);
  }

  pendingDeleteName() { return this.categorias().find(c => c.id === this.pendingDeleteId)?.nombre ?? ''; }
  destOptions() { return this.categorias().filter(c => c.id !== this.pendingDeleteId).map(c => ({ id: c.id, label: this.i18n.categoriaLabel(c.nombre) })); }

  cancelReassign() {
    this.reassignModal.set(false);
    this.pendingDeleteId = null;
    this.pendingDeleteCount = 0;
    this.reassignDestId = null;
  }

  private refreshAfterDelete() {
    this.load();
    this.shared.categoriasRefresh.update(v => v + 1);
    this.shared.historialRefresh.update(v => v + 1);
    this.shared.templatesRefresh.update(v => v + 1);
  }

  deleteCurrent() {
    const id = this.pendingDeleteId;
    if (id === null) { this.dialog.toast(this.i18n.t('common.error.delete'), 'error'); return; }
    this.api.deleteCategoria(id).subscribe({
      next: () => { this.cancelReassign(); this.refreshAfterDelete(); },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }

  confirmReassign() {
    const id = this.pendingDeleteId;
    if (id === null || this.reassignDestId === null) { this.dialog.toast(this.i18n.t('cfg.elegiDestino'), 'error'); return; }
    this.api.deleteCategoria(id, this.reassignDestId).subscribe({
      next: () => { this.cancelReassign(); this.refreshAfterDelete(); },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }
}