import { Component, signal, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { DialogService } from '../../../services/dialog.service';
import { SharedStateService } from '../../../services/shared-state.service';
import { Tag } from '../../../models/interfaces';
import { I18nService } from '../../../services/i18n.service';
import { DEFAULT_TAG_LABELS } from '../../../i18n/labels';
import { BackdropDismissDirective } from '../../../directives/backdrop-dismiss.directive';
import { slugify as slugifyUtil, stagger as staggerUtil } from '../../../utils/utils';

@Component({
  selector: 'app-config-tags',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './config-tags.component.html',
})
export class ConfigTagsComponent {
  tags = signal<Tag[]>([]);
  loading = signal(false);

  tagNombreError = signal('');
  modalTag = signal(false);
  editTagId = signal<number | null>(null);
  formTagNombre = '';
  formTagColor = '#3b82f6';

  reassignModal = signal(false);
  pendingDeleteId: number | null = null;
  pendingDeleteCount = 0;
  reassignDestId: number | null = null;

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    effect(() => { void this.shared.tagsRefresh(); this.load(); });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.reassignModal()) { this.cancelReassign(); return; }
    if (this.modalTag()) this.closeModals();
  }

  load() {
    this.loading.set(true);
    this.api.getTags().subscribe(d => { this.tags.set(d); this.loading.set(false); });
  }

  closeModals() { this.modalTag.set(false); this.editTagId.set(null); this.tagNombreError.set(''); }

  stagger(i: number): string { return staggerUtil(i); }

  slugify(name: string) { return slugifyUtil(name); }
  private errorToast(err: any, dupKey: any, fallbackKey: any) {
    if (err?.status === 409) this.dialog.toast(this.i18n.t(dupKey), 'error');
    else this.dialog.toast(this.i18n.t(fallbackKey), 'error');
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
            .subscribe({ next: () => { this.closeModals(); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
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
          .subscribe({ next: () => { this.closeModals(); this.shared.historialRefresh.update(v => v + 1); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
        return;
      }
    }
    (id ? this.api.updateTag(id, { nombre: n, color: this.formTagColor }) : this.api.createTag(n, this.formTagColor))
      .subscribe({ next: () => { this.closeModals(); this.shared.tagsRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.tagExiste', 'common.error.save') });
  }

  async removeTag(id: number) {
    const tag = this.tags().find(t => t.id === id);
    if (!tag) return;
    const affected = await new Promise<number>(resolve => {
      this.api.getPostulaciones().subscribe(list => resolve(list.filter(p => p.estado === tag.nombre).length));
    });
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
    this.reassignModal.set(true);
  }

  pendingDeleteName() { return this.tags().find(t => t.id === this.pendingDeleteId)?.nombre ?? ''; }
  destOptions() { return this.tags().filter(t => t.id !== this.pendingDeleteId).map(t => ({ id: t.id, label: this.i18n.tagLabel(t.nombre) })); }

  cancelReassign() {
    this.reassignModal.set(false);
    this.pendingDeleteId = null;
    this.pendingDeleteCount = 0;
    this.reassignDestId = null;
  }

  private refreshAfterDelete() {
    this.load();
    this.shared.tagsRefresh.update(v => v + 1);
    this.shared.historialRefresh.update(v => v + 1);
  }

  deleteCurrent() {
    const id = this.pendingDeleteId;
    if (id === null) { this.dialog.toast(this.i18n.t('common.error.delete'), 'error'); return; }
    this.api.deleteTag(id).subscribe({
      next: () => { this.cancelReassign(); this.refreshAfterDelete(); },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }

  confirmReassign() {
    const id = this.pendingDeleteId;
    if (id === null || this.reassignDestId === null) { this.dialog.toast(this.i18n.t('cfg.elegiDestino'), 'error'); return; }
    this.api.deleteTag(id, this.reassignDestId).subscribe({
      next: () => { this.cancelReassign(); this.refreshAfterDelete(); },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete'), 'error'),
    });
  }
}