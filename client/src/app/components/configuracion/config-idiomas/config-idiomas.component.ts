import { Component, signal, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { DialogService } from '../../../services/dialog.service';
import { SharedStateService } from '../../../services/shared-state.service';
import { Idioma } from '../../../models/interfaces';
import { I18nService } from '../../../services/i18n.service';
import { TemplatesCacheService } from '../../../services/templates-cache.service';
import { BackdropDismissDirective } from '../../../directives/backdrop-dismiss.directive';
import { stagger as staggerUtil } from '../../../utils/utils';

@Component({
  selector: 'app-config-idiomas',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './config-idiomas.component.html',
})
export class ConfigIdiomasComponent {
  private readonly ALL_IDIOMAS = ['ARA', 'CHI', 'DEU', 'ENG', 'ESP', 'FRA', 'HIN', 'ITA', 'JPN', 'KOR', 'POR', 'RUS'];
  idiomas = signal<Idioma[]>([]);
  availableIdiomas = signal(this.ALL_IDIOMAS);
  loading = signal(false);
  defaultIdiomaNombre = '';

  idiomaNombreError = signal('');
  modalIdioma = signal(false);
  editIdiomaId = signal<number | null>(null);
  formIdiomaNombre = '';

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
    private cache: TemplatesCacheService,
    public i18n: I18nService,
  ) {
    effect(() => { void this.shared.idiomasRefresh(); this.load(); });
    effect(() => { void this.shared.configRefresh(); this.load(); });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.modalIdioma()) this.closeModals();
  }

  load() {
    this.loading.set(true);
    this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); this.loading.set(false); });
    this.api.getConfig().subscribe(d => {
      const langDef = d.find(e => e.clave === 'default_idioma');
      if (langDef) this.defaultIdiomaNombre = langDef.valor;
    });
    this.cache.load();
  }

  closeModals() { this.modalIdioma.set(false); this.editIdiomaId.set(null); this.idiomaNombreError.set(''); }

  stagger(i: number): string { return staggerUtil(i); }

  idiomaRefCount(nombre: string): number { return this.cache.items().filter((t: any) => t.idioma === nombre).length; }

  private errorToast(err: any, dupKey: any, fallbackKey: any) {
    if (err?.status === 409) this.dialog.toast(this.i18n.t(dupKey), 'error');
    else this.dialog.toast(this.i18n.t(fallbackKey), 'error');
  }

  updateAvailableIdiomas() {
    const used = new Set(this.idiomas().map(i => i.nombre));
    this.availableIdiomas.set(this.ALL_IDIOMAS.filter(l => !used.has(l)));
  }

  openIdiomaModal(i?: Idioma) { this.editIdiomaId.set(i ? i.id : null); this.formIdiomaNombre = i ? i.nombre : ''; this.idiomaNombreError.set(''); this.modalIdioma.set(true); }

  async setDefaultIdioma(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.defaultIdiomaConfirm'));
    if (!ok) return;
    this.api.setDefaultIdioma(id).subscribe(() => {
      const idioma = this.idiomas().find(i => i.id === id);
      if (idioma) this.defaultIdiomaNombre = idioma.nombre;
      this.shared.configRefresh.update(v => v + 1);
    });
  }

  saveIdioma() {
    const n = this.formIdiomaNombre.trim(); if (!n) { this.idiomaNombreError.set(this.i18n.t('cfg.nombreRequerido')); return; }
    this.idiomaNombreError.set('');
    const id = this.editIdiomaId();
    (id ? this.api.updateIdioma(id, n) : this.api.createIdioma(n)).subscribe({ next: () => { this.closeModals(); this.shared.idiomasRefresh.update(v => v + 1); }, error: (err: any) => this.errorToast(err, 'cfg.idiomaExiste', 'common.error.save') });
  }

  async removeIdioma(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delIdioma'));
    if (!ok) return;
    this.api.deleteIdioma(id).subscribe(() => { this.shared.idiomasRefresh.update(v => v + 1); });
  }
}