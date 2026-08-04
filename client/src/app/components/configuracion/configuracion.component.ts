import { Component, OnInit, signal, computed, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { ConfigEntry, Categoria, Idioma, Tag } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';

type ConfigSection = 'datos' | 'categorias' | 'idiomas' | 'tags' | 'backup' | 'seguridad';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div>
      <nav class="flex border-b mb-5" style="border-color: var(--border);">
        @for (s of sections; track s.id) {
          <button class="relative px-3 py-2 text-sm font-medium cursor-pointer select-none bg-transparent border-0 rounded-none transition-colors"
            [style.color]="activeSection() === s.id ? 'var(--accent)' : ''"
            [style.opacity]="activeSection() === s.id ? '1' : '0.55'"
            (click)="activeSection.set(s.id)">
            {{ i18n.t(s.labelKey) }}
            @if (activeSection() === s.id) {
              <span class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style="background-color: var(--accent);"></span>
            }
          </button>
        }
      </nav>

      <!-- DATOS PERSONALES -->
      @if (activeSection() === 'datos') {
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <p class="text-sm" style="opacity: 0.55;">{{ i18n.t('cfg.intro') }}</p>
            <button class="btn btn-primary w-full sm:w-auto" (click)="openDatosModal()">{{ i18n.t('cfg.nuevaVariable') }}</button>
          </div>
          @if (loading()) {
            <div class="card text-center py-12 flex items-center justify-center gap-2" style="opacity: 0.5;"><span class="loader"></span> {{ i18n.t('common.loading') }}</div>
          } @else {
            @for (e of userEntries(); track e.id; let i = $index) {
              <div class="card flex items-center gap-3 animate-stagger" [style.animation-delay]="stagger(i)">
                <span class="text-sm font-mono shrink-0" style="min-width: 120px;">{{ e.clave }}</span>
                <span class="text-sm flex-1 truncate" style="opacity: 0.6;">{{ e.valor || '—' }}</span>
                <span class="text-xs shrink-0" style="opacity: 0.35; white-space: nowrap;">{{ refCount(e.clave) }} {{ i18n.t('cfg.refs') }}</span>
                <button class="btn btn-ghost btn-sm" (click)="openDatosModal(e)" [title]="i18n.t('common.edit')">✏️</button>
                <button class="btn btn-ghost btn-sm" (click)="removeDato(e.id)" [title]="i18n.t('common.delete')">🗑️</button>
              </div>
            }
          }
        </div>
      }

      <!-- CATEGORÍAS -->
      @if (activeSection() === 'categorias') {
        <div>
          <div class="flex justify-end mb-4">
            <button class="btn btn-primary w-full sm:w-auto" (click)="openCatModal()">{{ i18n.t('cfg.nuevaCategoria') }}</button>
          </div>
          @if (loading()) {
            <div class="card text-center py-12 flex items-center justify-center gap-2" style="opacity: 0.5;"><span class="loader"></span> {{ i18n.t('common.loading') }}</div>
          } @else {
            @for (c of categorias(); track c.id; let i = $index) {
              <div class="card flex items-center gap-3 animate-stagger" [style.animation-delay]="stagger(i)">
                <span class="text-sm flex-1">{{ i18n.categoriaLabel(c.nombre) }}</span>
                <span class="text-xs shrink-0" style="opacity: 0.35; white-space: nowrap;">{{ catRefCount(c.id) }} {{ i18n.t('cfg.refs') }}</span>
                <button class="btn btn-ghost btn-sm text-sm" (click)="setDefaultCategoria(c.id)" [style.opacity]="defaultCategoriaId === c.id ? '1' : '0.3'" [title]="i18n.t('cfg.setDefault')">⭐</button>
                <button class="btn btn-ghost btn-sm" (click)="openCatModal(c)" [title]="i18n.t('common.edit')">✏️</button>
                <button class="btn btn-ghost btn-sm" (click)="removeCategoria(c.id)" [title]="i18n.t('common.delete')">🗑️</button>
              </div>
            }
          }
        </div>
      }

      <!-- IDIOMAS -->
      @if (activeSection() === 'idiomas') {
        <div>
          <div class="flex justify-end mb-4">
            <button class="btn btn-primary w-full sm:w-auto" (click)="openIdiomaModal()">{{ i18n.t('cfg.nuevoIdioma') }}</button>
          </div>
          @if (loading()) {
            <div class="card text-center py-12 flex items-center justify-center gap-2" style="opacity: 0.5;"><span class="loader"></span> {{ i18n.t('common.loading') }}</div>
          } @else {
            @for (i of idiomas(); track i.id; let idx = $index) {
              <div class="card flex items-center gap-3 animate-stagger" [style.animation-delay]="stagger(idx)">
                <span class="text-sm flex-1">{{ i.nombre }}</span>
                <span class="text-xs shrink-0" style="opacity: 0.35; white-space: nowrap;">{{ idiomaRefCount(i.nombre) }} {{ i18n.t('cfg.refs') }}</span>
                <button class="btn btn-ghost btn-sm text-sm" (click)="setDefaultIdioma(i.id)" [style.opacity]="defaultIdiomaNombre === i.nombre ? '1' : '0.3'" [title]="i18n.t('cfg.setDefault')">⭐</button>
                <button class="btn btn-ghost btn-sm" (click)="openIdiomaModal(i)" [title]="i18n.t('common.edit')">✏️</button>
                <button class="btn btn-ghost btn-sm" (click)="removeIdioma(i.id)" [title]="i18n.t('common.delete')">🗑️</button>
              </div>
            }
          }
        </div>
      }

      <!-- TAGS -->
      @if (activeSection() === 'tags') {
        <div>
          <div class="flex justify-end mb-4">
            <button class="btn btn-primary w-full sm:w-auto" (click)="openTagModal()">{{ i18n.t('cfg.nuevoTag') }}</button>
          </div>
          @if (loading()) {
            <div class="card text-center py-12 flex items-center justify-center gap-2" style="opacity: 0.5;"><span class="loader"></span> {{ i18n.t('common.loading') }}</div>
          } @else {
            @for (t of tags(); track t.id; let i = $index) {
              <div class="card flex items-center gap-3 animate-stagger" [style.animation-delay]="stagger(i)">
                <span class="w-3 h-3 rounded-full shrink-0" [style.background-color]="t.color"></span>
                <span class="text-sm flex-1">{{ i18n.tagLabel(t.nombre) }}</span>
                <button class="btn btn-ghost btn-sm" (click)="openTagModal(t)" [title]="i18n.t('common.edit')">✏️</button>
                <button class="btn btn-ghost btn-sm" (click)="removeTag(t.id)" [title]="i18n.t('common.delete')">🗑️</button>
              </div>
            }
          }
        </div>
      }

      <!-- BACKUP -->
      @if (activeSection() === 'backup') {
        <div>
          <p class="text-sm mb-4" style="opacity: 0.55;">{{ i18n.t('backup.intro') }}</p>
          <div class="flex flex-col sm:flex-row gap-2">
            <button class="btn btn-primary" (click)="exportBackup()">⬇️ {{ i18n.t('backup.export') }}</button>
            <button class="btn btn-outline" (click)="fileInput.click()">⬆️ {{ i18n.t('backup.import') }}</button>
            <input #fileInput type="file" accept="application/json,.json" style="display:none;" (change)="onFileSelected($event)" />
          </div>
        </div>
      }

      <!-- CAMBIAR CONTRASEÑA -->
      @if (activeSection() === 'seguridad') {
        <div class="max-w-sm">
          <p class="text-sm mb-4" style="opacity: 0.55;">{{ i18n.t('auth.changePasswordHint') }}</p>
          <form (ngSubmit)="changePassword()" class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.currentPassword') }}</span>
              <input type="password" [(ngModel)]="formCurrentPassword" name="currentPassword" autocomplete="current-password" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.newPassword') }}</span>
              <input type="password" [(ngModel)]="formNewPassword" name="newPassword" autocomplete="new-password" required />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('auth.confirmPassword') }}</span>
              <input type="password" [(ngModel)]="formConfirmPassword" name="confirmNewPassword" autocomplete="new-password" required />
            </label>
            <p class="text-xs" style="opacity: 0.5;">{{ i18n.t('auth.passwordHint') }}</p>

            @if (pwMsg()) {
              <p class="text-sm" [style.color]="pwOk() ? '#16a34a' : '#dc2626'">{{ pwMsg() }}</p>
            }

            <button type="submit" class="btn btn-primary w-full" [disabled]="pwLoading()">
              @if (pwLoading()) {
                <span class="loader" style="border-top-color: #fff;"></span>
              } @else {
                {{ i18n.t('auth.changePassword') }}
              }
            </button>
          </form>
        </div>
      }
    </div>

    <!-- DATOS MODAL -->
    @if (modalDatos()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" style="background: rgba(0,0,0,0.35);">
        <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ editDatoId() ? i18n.t('cfg.dato.editar') : i18n.t('cfg.dato.nueva') }}</h3>
          <div class="space-y-3">
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('cfg.clave') }}</label><input [(ngModel)]="formDatoClave" class="text-sm font-mono" /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('cfg.valor') }}</label><input [(ngModel)]="formDatoValor" class="text-sm" /></div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeModals()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveDato()">{{ editDatoId() ? i18n.t('common.save') : i18n.t('common.create') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- CATEGORÍA MODAL -->
    @if (modalCat()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" style="background: rgba(0,0,0,0.35);">
        <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ editCatId() ? i18n.t('cfg.categoria.editar') : i18n.t('cfg.categoria.nueva') }}</h3>
          <input [(ngModel)]="formCatNombre" class="text-sm" [placeholder]="i18n.t('cfg.nombre')" />
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeModals()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveCategoria()">{{ editCatId() ? i18n.t('common.save') : i18n.t('common.create') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- IDIOMA MODAL -->
    @if (modalIdioma()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" style="background: rgba(0,0,0,0.35);">
        <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ editIdiomaId() ? i18n.t('cfg.idioma.editar') : i18n.t('cfg.idioma.nuevo') }}</h3>
          @if (!editIdiomaId()) {
            <select [(ngModel)]="formIdiomaNombre" class="text-sm">
              <option [ngValue]="''" disabled>{{ i18n.t('cfg.idioma.select') }}</option>
              @for (lang of availableIdiomas(); track lang) { <option [value]="lang">{{ lang }}</option> }
            </select>
          } @else {
            <input [(ngModel)]="formIdiomaNombre" class="text-sm" [placeholder]="i18n.t('cfg.idioma.ej')" />
          }
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeModals()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveIdioma()">{{ editIdiomaId() ? i18n.t('common.save') : i18n.t('common.create') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- TAG MODAL -->
    @if (modalTag()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" style="background: rgba(0,0,0,0.35);">
        <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ editTagId() ? i18n.t('cfg.tag.editar') : i18n.t('cfg.tag.nuevo') }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('cfg.nombre') }}</label>
              <input [(ngModel)]="formTagNombre" class="text-sm" [placeholder]="i18n.t('cfg.tagPlaceholder')" />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('cfg.color') }}</label>
              <div class="flex items-center gap-2">
                <button type="button" class="w-8 h-8 rounded-md flex items-center justify-center text-base border-0 cursor-pointer transition-colors" style="font-size: 1rem; background: transparent;" (click)="tagColorInput.click()" [title]="i18n.t('cfg.elegirColor')">🎨</button>
                <input #tagColorInput type="color" [(ngModel)]="formTagColor" style="position: absolute; width: 0; height: 0; opacity: 0; border: none; padding: 0; margin: 0; overflow: hidden;" />
                <span class="w-5 h-5 rounded-full shrink-0" style="border: 2px solid var(--border);" [style.background-color]="formTagColor"></span>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeModals()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveTag()">{{ editTagId() ? i18n.t('common.save') : i18n.t('common.create') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- ELIMINAR TAG: REASIGNACIÓN -->
    @if (deleteTagModal()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" style="background: rgba(0,0,0,0.35);">
        <div class="card w-full max-w-sm mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-2">{{ i18n.t('cfg.deleteTagTitle') }}</h3>
          <p class="text-sm mb-4" style="opacity: 0.7;">{{ i18n.t('cfg.deleteTagMsg', { tag: i18n.tagLabel(pendingTagName()), count: pendingDeleteCount }) }}</p>
          <select [(ngModel)]="reassignTagId" class="text-sm">
            @for (t of deleteDestTags(); track t.id) { <option [ngValue]="t.id">{{ i18n.tagLabel(t.nombre) }}</option> }
          </select>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="cancelDeleteTag()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="confirmDeleteTag()">{{ i18n.t('cfg.deleteAndReassign') }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfiguracionComponent implements OnInit {
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
  defaultCategoriaId: number | null = null;
  defaultIdiomaNombre = '';
  tags = signal<Tag[]>([]);

  modalDatos = signal(false); editDatoId = signal<number | null>(null); formDatoClave = ''; formDatoValor = '';
  modalCat = signal(false); editCatId = signal<number | null>(null); formCatNombre = '';
  modalIdioma = signal(false); editIdiomaId = signal<number | null>(null); formIdiomaNombre = '';
  modalTag = signal(false); editTagId = signal<number | null>(null); formTagNombre = ''; formTagColor = '#3b82f6';
  deleteTagModal = signal(false); pendingDeleteId: number | null = null; pendingDeleteCount = 0; reassignTagId: number | null = null;

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

  ngOnInit() {}

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.deleteTagModal()) { this.cancelDeleteTag(); return; }
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

  closeModals() { this.modalDatos.set(false); this.editDatoId.set(null); this.modalCat.set(false); this.editCatId.set(null); this.modalIdioma.set(false); this.editIdiomaId.set(null); this.modalTag.set(false); this.editTagId.set(null); this.deleteTagModal.set(false); this.pendingDeleteId = null; this.reassignTagId = null; }

  refCount(clave: string): number {
    let c = 0; const r = new RegExp(`\\{${clave}\\}`, 'g');
    for (const t of this.allTemplates) if (r.test(t.contenido)) c++;
    return c;
  }

  bra(s: string) { return '{' + s + '}'; }

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
    if (e) { this.editDatoId.set(e.id); this.formDatoClave = e.clave; this.formDatoValor = e.valor; this.oldClave = e.clave; }
    else { this.editDatoId.set(null); this.formDatoClave = ''; this.formDatoValor = ''; this.oldClave = ''; }
    this.modalDatos.set(true);
  }

  async saveDato() {
    const clave = this.formDatoClave.trim(); const valor = this.formDatoValor;
    if (!clave) { this.dialog.toast(this.i18n.t('cfg.claveVacia')); return; }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(clave)) { this.dialog.toast(this.i18n.t('cfg.claveInvalida')); return; }
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
    const req = id ? this.api.updateConfig(id, { clave, valor }) : this.api.createConfig(clave, valor);
    req.subscribe(() => { this.shared.configRefresh.update(v => v + 1); this.closeModals(); this.api.getConfig().subscribe(d => this.entries.set(d)); });
  }

  async removeDato(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delVariable'));
    if (!ok) return;
    this.api.deleteConfig(id).subscribe(() => { this.shared.configRefresh.update(v => v + 1); this.api.getConfig().subscribe(d => this.entries.set(d)); });
  }

  // ── CATEGORÍAS ──
  openCatModal(c?: Categoria) { this.editCatId.set(c ? c.id : null); this.formCatNombre = c ? c.nombre : ''; this.modalCat.set(true); }
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

  saveCategoria() {
    const n = this.formCatNombre.trim(); if (!n) { this.dialog.toast(this.i18n.t('cfg.nombreRequerido')); return; }
    const id = this.editCatId();
    (id ? this.api.updateCategoria(id, n) : this.api.createCategoria(n)).subscribe({ next: () => { this.closeModals(); this.api.getCategorias().subscribe(d => this.categorias.set(d)); this.shared.categoriasRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.save')) });
  }
  async removeCategoria(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delCategoria'));
    if (!ok) return;
    this.api.deleteCategoria(id).subscribe(() => { this.api.getCategorias().subscribe(d => this.categorias.set(d)); this.shared.categoriasRefresh.update(v => v + 1); this.shared.templatesRefresh.update(v => v + 1); });
  }

  // ── IDIOMAS ──
  openIdiomaModal(i?: Idioma) { this.editIdiomaId.set(i ? i.id : null); this.formIdiomaNombre = i ? i.nombre : ''; this.modalIdioma.set(true); }
  saveIdioma() {
    const n = this.formIdiomaNombre.trim(); if (!n) { this.dialog.toast(this.i18n.t('cfg.nombreRequerido')); return; }
    const id = this.editIdiomaId();
    (id ? this.api.updateIdioma(id, n) : this.api.createIdioma(n)).subscribe({ next: () => { this.closeModals(); this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); }); this.shared.idiomasRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.save')) });
  }
  async removeIdioma(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('cfg.delIdioma'));
    if (!ok) return;
    this.api.deleteIdioma(id).subscribe(() => { this.api.getIdiomas().subscribe(d => { this.idiomas.set(d); this.updateAvailableIdiomas(); }); this.shared.idiomasRefresh.update(v => v + 1); });
  }

  // ── BACKUP ──
  exportBackup() {
    this.api.exportBackup().subscribe((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postulatool-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.dialog.toast(this.i18n.t('backup.exportDone'));
    });
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
        this.api.importBackup(data).subscribe({
          next: () => {
            this.dialog.toast(this.i18n.t('backup.importDone'));
            this.shared.configRefresh.update(v => v + 1);
            this.shared.categoriasRefresh.update(v => v + 1);
            this.shared.idiomasRefresh.update(v => v + 1);
            this.shared.tagsRefresh.update(v => v + 1);
            this.shared.templatesRefresh.update(v => v + 1);
            this.shared.historialRefresh.update(v => v + 1);
            this.initData();
          },
          error: () => this.dialog.toast(this.i18n.t('backup.importError')),
        });
      } catch {
        this.dialog.toast(this.i18n.t('backup.importError'));
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  // ── TAGS ──
  slugify(name: string) { return name.trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, ''); }
  openTagModal(t?: Tag) {
    this.editTagId.set(t ? t.id : null);
    this.formTagNombre = t ? this.i18n.tagLabel(t.nombre) : '';
    this.formTagColor = t ? t.color : '#3b82f6';
    this.modalTag.set(true);
  }
  async saveTag() {
    const n = this.slugify(this.formTagNombre); if (!n) { this.dialog.toast(this.i18n.t('cfg.nombreRequerido')); return; }
    const id = this.editTagId();
    if (id) {
      const old = this.tags().find(t => t.id === id);
      if (old && n !== old.nombre) {
        const sameLabel = this.i18n.tagLabel(n) === this.i18n.tagLabel(old.nombre);
        if (sameLabel) {
          // El usuario re-escribió el mismo label traducido: solo actualiza color, no renombra.
          this.api.updateTag(id, { nombre: old.nombre, color: this.formTagColor })
            .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.tagsRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.save')) });
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
          .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.historialRefresh.update(v => v + 1); this.shared.tagsRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.save')) });
        return;
      }
    }
    (id ? this.api.updateTag(id, { nombre: n, color: this.formTagColor }) : this.api.createTag(n, this.formTagColor))
      .subscribe({ next: () => { this.closeModals(); this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.tagsRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.save')) });
  }
  async removeTag(id: number) {
    const tag = this.tags().find(t => t.id === id);
    if (!tag) return;
    const affected = await new Promise<number>(resolve => {
      this.api.getPostulaciones().subscribe(list => resolve(list.filter(p => p.estado === tag.nombre).length));
    });
    if (affected === 0) {
      const ok = await this.dialog.confirm(this.i18n.t('cfg.deleteTagSimple', { tag: this.i18n.tagLabel(tag.nombre) }));
      if (!ok) return;
      this.api.deleteTag(id).subscribe({ next: () => { this.api.getTags().subscribe(d => this.tags.set(d)); this.shared.tagsRefresh.update(v => v + 1); this.shared.historialRefresh.update(v => v + 1); }, error: () => this.dialog.toast(this.i18n.t('common.error.delete')) });
      return;
    }
    const others = this.tags().filter(t => t.id !== id);
    if (others.length === 0) {
      this.dialog.toast(this.i18n.t('cfg.sinOtrasEtiquetas'));
      return;
    }
    this.pendingDeleteId = id;
    this.pendingDeleteCount = affected;
    this.reassignTagId = others[0].id;
    this.deleteTagModal.set(true);
  }

  pendingTagName() { return this.tags().find(t => t.id === this.pendingDeleteId)?.nombre ?? ''; }
  deleteDestTags() { return this.tags().filter(t => t.id !== this.pendingDeleteId); }

  cancelDeleteTag() {
    this.deleteTagModal.set(false);
    this.pendingDeleteId = null;
    this.reassignTagId = null;
  }

  confirmDeleteTag() {
    const id = this.pendingDeleteId;
    if (id === null || this.reassignTagId === null) { this.dialog.toast(this.i18n.t('cfg.elegiDestino')); return; }
    this.api.deleteTag(id, this.reassignTagId).subscribe({
      next: () => {
        this.cancelDeleteTag();
        this.api.getTags().subscribe(d => this.tags.set(d));
        this.shared.tagsRefresh.update(v => v + 1);
        this.shared.historialRefresh.update(v => v + 1);
      },
      error: () => this.dialog.toast(this.i18n.t('common.error.delete')),
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
    return `${Math.min(i * 30, 300)}ms`;
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
