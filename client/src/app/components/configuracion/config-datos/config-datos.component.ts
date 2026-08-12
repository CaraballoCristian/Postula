import { Component, signal, computed, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { DialogService } from '../../../services/dialog.service';
import { SharedStateService } from '../../../services/shared-state.service';
import { ConfigEntry, Postulacion } from '../../../models/interfaces';
import { I18nService } from '../../../services/i18n.service';
import { TemplatesCacheService } from '../../../services/templates-cache.service';
import { BackdropDismissDirective } from '../../../directives/backdrop-dismiss.directive';
import { stagger as staggerUtil } from '../../../utils/utils';
import { markErrorHandled } from '../../../interceptors/error.interceptor';

@Component({
  selector: 'app-config-datos',
  standalone: true,
  imports: [FormsModule, BackdropDismissDirective],
  templateUrl: './config-datos.component.html',
})
export class ConfigDatosComponent {
  private readonly RESERVED_KEYS = ['default_categoria_id', 'default_idioma'];
  entries = signal<ConfigEntry[]>([]);
  userEntries = computed(() => this.entries().filter(e => !this.RESERVED_KEYS.includes(e.clave)));
  loading = signal(false);
  private oldClave = '';

  claveError = signal('');
  modalDatos = signal(false);
  editDatoId = signal<number | null>(null);
  formDatoClave = '';
  formDatoValor = '';

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
    private cache: TemplatesCacheService,
    public i18n: I18nService,
  ) {
    effect(() => { void this.shared.configRefresh(); this.load(); });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.modalDatos()) this.closeModals();
  }

  load() {
    this.loading.set(true);
    this.api.getConfig().subscribe(d => { this.entries.set(d); this.loading.set(false); });
  }

  closeModals() { this.modalDatos.set(false); this.editDatoId.set(null); this.claveError.set(''); }

  stagger(i: number): string { return staggerUtil(i); }

  refCount(clave: string): number {
    let c = 0; const r = new RegExp(`\\{${clave}\\}`, 'g');
    for (const t of this.cache.items()) if (r.test(t.contenido)) c++;
    return c;
  }

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
      const affected = this.cache.items().filter((t: any) => new RegExp(`\\{${this.oldClave}\\}`, 'g').test(t.contenido));
      if (affected.length > 0) {
        const ok = await this.dialog.confirm(this.i18n.t('cfg.renameClave', { old: `{${this.oldClave}}`, new: `{${clave}}`, count: affected.length }));
        if (!ok) return;
        for (const t of affected) { this.api.updateTemplate(t.id, { contenido: t.contenido.replace(new RegExp(`\\{${this.oldClave}\\}`, 'g'), `{${clave}}`) }).subscribe(); }
        this.cache.load();
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
    req.subscribe(() => { this.shared.configRefresh.update(v => v + 1); this.closeModals(); });
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
    for (const t of this.cache.items() as any[]) tplMap.set(t.id, t);
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
      }).subscribe({ next: () => r(), error: (err) => { markErrorHandled(err); r(); } }));
      done++;
    }
    if (done > 0) this.dialog.toast(this.i18n.t('cfg.propDatoDone', { count: done }));
    return true;
  }

  async removeDato(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delVariable'));
    if (!ok) return;
    this.api.deleteConfig(id).subscribe(() => { this.shared.configRefresh.update(v => v + 1); });
  }
}