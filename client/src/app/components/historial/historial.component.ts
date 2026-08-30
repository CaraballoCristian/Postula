import { Component, signal, computed, effect, HostListener, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { Postulacion, Categoria, ESTADOS, Empresa } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';
import { PostulacionTableComponent } from '../postulacion-table/postulacion-table.component';
import { EmpresaGrupo, groupByEmpresa } from '../../utils/grouping';
import { fixUrl as fixUrlUtil, formatFecha as formatFechaUtil, stagger as staggerUtil } from '../../utils/utils';
import { OTRAS, DEFAULT_ESTADO } from '../../models/constants';
import { markErrorHandled } from '../../interceptors/error.interceptor';
import { HistFiltrosComponent } from '../hist-filtros/hist-filtros.component';
import { HistPorEmpresaComponent } from '../hist-por-empresa/hist-por-empresa.component';
import { HistEditarModalComponent } from '../hist-editar-modal/hist-editar-modal.component';
import { HistEmpresaLinkModalComponent, EmpresaLinkModalData } from '../hist-empresa-link-modal/hist-empresa-link-modal.component';

type SortField = 'fecha' | 'empresa' | 'categoria_id' | 'idioma' | 'oferta_laboral' | 'nombre_empleado' | 'puesto_empleado' | 'favorito' | 'estado';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [PostulacionTableComponent, HistFiltrosComponent, HistPorEmpresaComponent, HistEditarModalComponent, HistEmpresaLinkModalComponent],
  templateUrl: './historial.component.html',
})
export class HistorialComponent {
  private destroyRef = inject(DestroyRef);
  postulaciones = signal<Postulacion[]>([]);
  viewMode = signal<'tabla' | 'empresa'>(localStorage.getItem('postulatool.hist.view') === 'empresa' ? 'empresa' : 'tabla');
  filtroGlobal = signal('');
  categorias: Categoria[] = [];
  checkedCategorias = signal<Set<number>>(new Set());
  checkedEstados = signal<Set<string>>(new Set());
  idiomas: string[] = [];
  checkedIdiomas = signal<Set<string>>(new Set());
  openDropdown = signal<'cat' | 'est' | 'idioma' | null>(null);
  private closeDropdown = () => this.openDropdown.set(null);
  sortField = signal<SortField>('fecha');
  sortDir = signal<'asc' | 'desc'>('desc');
  expandedId = signal<number | null>(null);
  expandedMsg = signal<string | null>(null);
  estados = ESTADOS;
  msgTipos = ['email', 'mensaje_empresa', 'mensaje_recruiter'];
  editModal = signal(false);
  editForm: any = {};
  private editId: number | null = null;
  editUsed = signal<Set<string>>(new Set());
  editEmpresaOptions: string[] = [];
  private editLinkOriginal = '';

  // Bulk selection
  selectionMode = signal(false);
  selectedIds = signal<Set<number>>(new Set());
  bulkEstado = DEFAULT_ESTADO;

  columns: { field: SortField; labelKey: any }[] = [
    { field: 'favorito',      labelKey: '' },
    { field: 'fecha',          labelKey: 'hist.col.fecha' },
    { field: 'empresa',        labelKey: 'hist.col.empresa' },
    { field: 'categoria_id',   labelKey: 'hist.col.categoria' },
    { field: 'idioma',          labelKey: 'hist.col.idioma' },
    { field: 'oferta_laboral', labelKey: 'hist.col.oferta' },
    { field: 'nombre_empleado', labelKey: 'hist.col.empleado' },
    { field: 'puesto_empleado', labelKey: 'hist.col.puesto' },
    { field: 'estado',         labelKey: 'hist.col.estado' },
  ];

  empresaTableColumns: { field: SortField; labelKey: any }[] = [
    { field: 'favorito',      labelKey: '' },
    { field: 'fecha',          labelKey: 'hist.col.fecha' },
    { field: 'categoria_id',   labelKey: 'hist.col.categoria' },
    { field: 'oferta_laboral', labelKey: 'hist.col.oferta' },
    { field: 'nombre_empleado', labelKey: 'hist.col.empleado' },
    { field: 'puesto_empleado', labelKey: 'hist.col.puesto' },
    { field: 'estado',         labelKey: 'hist.col.estado' },
  ];

  // ── Vista "Por empresa" ──
  empresas = signal<Empresa[]>([]);
  empresaSortDir = signal<'asc' | 'desc'>('asc');
  openEmpresas = signal<Set<string>>(new Set());
  openEmpresaMensajes = signal<Set<string>>(new Set());
  empresaLinkModal = signal<EmpresaLinkModalData | null>(null);

  grupos = computed<EmpresaGrupo[]>(() => {
    // Empresas con postulaciones (según filtros) + empresas sin postulaciones,
    // para que puedan editarse/eliminarse manualmente desde esta vista.
    const q = this.filtroGlobal().toLowerCase().trim();
    const byName = new Map<string, EmpresaGrupo>();
    for (const g of groupByEmpresa(this.filteredSorted())) {
      byName.set(g.nombre.toLowerCase().trim(), g);
    }
    for (const e of this.empresas()) {
      const key = e.nombre.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, { nombre: e.nombre, items: [] });
    }
    let all = [...byName.values()];
    if (q) {
      // Con búsqueda activa: quedan los grupos con postulaciones que coinciden
      // (empresa/oferta/nombre/puesto, ya filtrados en filteredSorted) y las
      // empresas sin postulaciones cuyo nombre coincide con el texto.
      all = all.filter(g => g.items.length > 0 || g.nombre.toLowerCase().includes(q));
    }
    const dir = this.empresaSortDir();
    all.sort((a, b) => {
      const cmp = a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase());
      return dir === 'asc' ? cmp : -cmp;
    });
    return all;
  });

  empresaCount = computed(() => this.grupos().length);

  toggleEmpresaSort() { this.empresaSortDir.update(d => d === 'asc' ? 'desc' : 'asc'); }

  toggleEmpresa(nombre: string) {
    this.openEmpresas.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }

  toggleEmpresaMensaje(nombre: string) {
    this.openEmpresaMensajes.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }

  findEmpresa(nombre: string): Empresa | undefined {
    const n = nombre.trim().toLowerCase();
    return this.empresas().find(e => e.nombre.trim().toLowerCase() === n);
  }

  empresaLink(nombre: string): string {
    const e = this.findEmpresa(nombre);
    if (e?.link) return e.link;
    const g = this.grupos().find(x => x.nombre === nombre);
    return g?.items.find(p => p.link_empresa)?.link_empresa || '';
  }

  getEmpresaMensaje(nombre: string): string | null {
    const e = this.findEmpresa(nombre);
    if (e?.resultado_empresa) return e.resultado_empresa;
    const g = this.grupos().find(x => x.nombre === nombre);
    return g?.items.find(p => p.resultado_empresa)?.resultado_empresa || null;
  }

  postCountLabel(n: number): string {
    return n === 1 ? this.i18n.t('hist.postulacion', { count: n }) : this.i18n.t('hist.postulaciones', { count: n });
  }

  hasFavorita(g: EmpresaGrupo): boolean {
    return g.items.some(p => p.favorito);
  }

  openEmpresaLinkModal(nombre: string) {
    const e = this.findEmpresa(nombre);
    if (e) {
      this.empresaLinkModal.set({ id: e.id, nombre: e.nombre, nombreOriginal: e.nombre, link: e.link, linkOriginal: e.link });
    } else {
      // No hay registro de empresa (p. ej. tras importar): el modal igual abre y al guardar lo crea.
      this.empresaLinkModal.set({ id: null, nombre, nombreOriginal: nombre, link: this.empresaLink(nombre), linkOriginal: '' });
    }
  }

  closeEmpresaLinkModal() { this.empresaLinkModal.set(null); }

  async saveEmpresaLink() {
    const m = this.empresaLinkModal();
    if (!m) return;
    const linkNuevo = (m.link || '').trim();
    const linkOriginal = m.linkOriginal || '';
    const empName = (m.nombre || '').trim();
    const matchesEmpresa = (nombre: string) => nombre.trim().toLowerCase() === empName.toLowerCase();

    if (!empName) { this.dialog.toast(this.i18n.t('common.required'), 'error'); return; }

    const nombreOriginal = (m.nombreOriginal || '').trim();

    if (m.id != null && empName !== nombreOriginal) {
      const n = this.postulaciones().filter(p => p.empresa.trim().toLowerCase() === nombreOriginal.toLowerCase()).length;
      const ok = await this.dialog.confirm(this.i18n.t('hist.renameEmpresaConfirm', {
        old: nombreOriginal,
        new: empName,
        count: n,
      }));
      if (!ok) {
        this.empresaLinkModal.set({ ...m, nombre: nombreOriginal });
        return;
      }
    }

    if (linkNuevo !== linkOriginal) {
      const n = this.postulaciones().filter(p => matchesEmpresa(p.empresa)).length;
      const ok = await this.dialog.confirm(this.i18n.t('hist.linkChangeConfirm', {
        empresa: empName,
        count: n,
        from: linkOriginal || '—',
        to: linkNuevo || '—',
      }));
      if (!ok) {
        this.empresaLinkModal.set({ ...m, link: linkOriginal });
        return;
      }
    }

    if (m.id == null) {
      // No existe registro de empresa: crearlo (o vincular al existente con ese nombre).
      this.api.createEmpresa({ nombre: empName, link: linkNuevo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.closeEmpresaLinkModal();
          this.shared.empresasRefresh.update(v => v + 1);
          this.load();
        },
        error: (err: any) => {
          if (err?.error?.error === 'EMPRESA_EXISTE') {
            this.loadEmpresas(() => {
              const e = this.findEmpresa(empName);
              if (e) {
                this.api.updateEmpresa(e.id, { link: linkNuevo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
                  this.closeEmpresaLinkModal();
                  this.shared.empresasRefresh.update(v => v + 1);
                  this.load();
                });
              } else {
                this.closeEmpresaLinkModal();
                this.shared.empresasRefresh.update(v => v + 1);
                this.load();
              }
            });
          } else {
            this.dialog.toast(this.i18n.t('common.error.save'), 'error');
          }
        },
      });
      return;
    }

    const original = this.empresas().find(e => e.id === m.id)?.nombre;
    this.api.updateEmpresa(m.id, { nombre: m.nombre, link: linkNuevo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (original && m.nombre !== original) {
          this.openEmpresas.update(s => {
            const n = new Set(s);
            n.delete(original);
            n.add(m.nombre);
            return n;
          });
        }
        this.closeEmpresaLinkModal();
        this.shared.empresasRefresh.update(v => v + 1);
        this.load();
      },
      error: (err: any) => {
        if (err?.error?.error === 'EMPRESA_EXISTE') this.dialog.toast(this.i18n.t('np.empresaExiste'), 'error');
        else this.dialog.toast(this.i18n.t('common.error.save'), 'error');
      },
    });
  }

  async deleteEmpresaGroup(g: EmpresaGrupo) {
    const count = g.items.length;
    const ok = await this.dialog.confirm(this.i18n.t('hist.delEmpresaConfirm', { empresa: g.nombre, count }));
    if (!ok) return;
    const e = this.findEmpresa(g.nombre);
    if (e) {
      this.api.deleteEmpresa(e.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.openEmpresas.update(s => { const n = new Set(s); n.delete(g.nombre); return n; });
          this.shared.empresasRefresh.update(v => v + 1);
          this.load();
        },
        error: (err) => { markErrorHandled(err); this.dialog.toast(this.i18n.t('common.error.save'), 'error'); },
      });
    } else {
      for (const p of g.items) {
        await new Promise<void>(r => this.api.deletePostulacion(p.id).subscribe({ next: () => r(), error: (err) => { markErrorHandled(err); r(); } }));
      }
      this.load();
    }
  }

  loadEmpresas(onDone?: () => void) {
    this.api.getEmpresas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => {
      this.empresas.set(d);
      onDone?.();
    });
  }

  catNombres: Record<number, string> = {};
  loaded = signal(false);
  loading = signal(false);
  private inited = false;
  readonly OTRAS = OTRAS;

  constructor(
    private api: ApiService,
    public clipboard: ClipboardService,
    private dialog: DialogService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    effect(() => { void shared.historialRefresh(); if (this.inited) this.load(); });
    effect(() => { void shared.tagsRefresh(); if (this.inited) this.loadTags(); });
    effect(() => { void shared.categoriasRefresh(); if (this.inited) this.loadCategorias(); });
    effect(() => { void shared.idiomasRefresh(); if (this.inited) this.loadIdiomas(); });
    effect(() => { void shared.empresasRefresh(); if (this.inited) this.loadEmpresas(); });
    effect(() => {
      if (this.shared.activeTab() === 'historial' && !this.loaded()) {
        this.initData();
        this.loaded.set(true);
      }
    });
    effect(() => {
      if (this.shared.activeTab() === 'historial') this.focusSearchTick.update(v => v + 1);
    });
    effect(() => this.persistFilters());
    document.addEventListener('click', this.closeDropdown);
    this.destroyRef.onDestroy(() => document.removeEventListener('click', this.closeDropdown));
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.empresaLinkModal()) { this.closeEmpresaLinkModal(); return; }
    if (this.editModal()) { this.closeEditModal(); return; }
    if (this.expandedId()) { this.expandedId.set(null); this.expandedMsg.set(null); return; }
  }

  private persistFilters() {
    const data = {
      cat: [...this.checkedCategorias()],
      est: [...this.checkedEstados()],
      idioma: [...this.checkedIdiomas()],
    };
    localStorage.setItem('postulatool.hist.filters', JSON.stringify(data));
  }

  private restoreFilters() {
    try {
      const raw = localStorage.getItem('postulatool.hist.filters');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.cat)) this.checkedCategorias.set(new Set(data.cat));
      if (Array.isArray(data.est)) this.checkedEstados.set(new Set(data.est));
      if (Array.isArray(data.idioma)) this.checkedIdiomas.set(new Set(data.idioma));
    } catch { /* ignore */ }
  }

  initData() {
    this.restoreFilters();
    this.loading.set(true);
    let done = 0;
    const checkDone = () => { if (++done >= 5) this.loading.set(false); };
    this.loadCategorias(checkDone);
    this.loadTags(checkDone);
    this.loadIdiomas(checkDone);
    this.loadEmpresas(checkDone);
    this.api.getPostulaciones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.postulaciones.set(d); checkDone(); });
    this.inited = true;
  }

  load() { this.loading.set(true); this.api.getPostulaciones({ trashed: this.trashMode() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.postulaciones.set(d); this.loading.set(false); }); }

  loadCategorias(onDone?: () => void) {
    this.api.getCategorias().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => {
      this.categorias = d;
      this.catNombres = {};
      for (const c of d) this.catNombres[c.id] = c.nombre;
      const oldChecked = new Set(this.checkedCategorias());
      if (oldChecked.size === 0) {
        this.checkedCategorias.set(new Set(d.map(c => c.id)));
      } else {
        this.checkedCategorias.update(s => new Set([...s].filter(id => d.some(c => c.id === id))));
      }
      onDone?.();
    });
  }

  loadIdiomas(onDone?: () => void) {
    this.api.getIdiomas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => {
      const oldChecked = new Set(this.checkedIdiomas());
      const oldNames = new Set(this.idiomas);
      const newNames = d.map(i => i.nombre);
      this.idiomas = newNames;
      let next: Set<string>;
      if (oldChecked.size === 0) {
        next = new Set(newNames);
      } else {
        next = new Set([...oldChecked].filter(n => newNames.includes(n)));
        const added = newNames.filter(x => !oldNames.has(x));
        const removed = [...oldNames].filter(x => !newNames.includes(x));
        if (removed.length === 1 && added.length === 1 && oldChecked.has(removed[0])) next.add(added[0]);
      }
      this.checkedIdiomas.set(next);
      onDone?.();
    });
  }

  loadTags(onDone?: () => void) {
    this.api.getTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => {
      const oldChecked = new Set(this.checkedEstados());
      const oldNames = new Set(this.estados.map(e => e.value));
      this.estados = d.map(t => ({ value: t.nombre, label: this.i18n.tagLabel(t.nombre), color: t.color }));
      if (d.length === 0) {
        for (const e of ESTADOS) this.estados.push({ value: e.value, label: e.label, color: e.color });
      }
      this.estados.push({ value: this.OTRAS, label: this.i18n.t('hist.sinEtiqueta'), color: '#eee' });
      const newNames = this.estados.map(e => e.value);
      let next: Set<string>;
      if (oldChecked.size === 0) {
        next = new Set(newNames.filter(n => n !== 'rechazado'));
      } else {
        next = new Set([...oldChecked].filter(n => newNames.includes(n)));
        const added = newNames.filter(x => !oldNames.has(x));
        const removed = [...oldNames].filter(x => !newNames.includes(x));
        if (removed.length === 1 && added.length === 1 && oldChecked.has(removed[0])) next.add(added[0]);
      }
      this.checkedEstados.set(next);
      onDone?.();
    });
  }

  catNombre(id: number) { return this.catNombres[id] ? this.i18n.categoriaLabel(this.catNombres[id]) : ''; }
  estadoLabel(v: string) { return v === this.OTRAS ? this.i18n.t('hist.sinEtiqueta') : this.i18n.tagLabel(v); }

  // Clave de orden/agrupación: cualquier estado que no sea una tag real (huérfano importado,
  // "sin etiqueta") colapsa al mismo valor para que queden juntos al ordenar/filtrar.
  estadoGroupKey(v: string) { return this.estados.some(e => e.value === v) && v !== this.OTRAS ? this.estadoLabel(v) : this.i18n.t('hist.sinEtiqueta'); }
  estadoColor(v: string) { return this.estados.find(e => e.value === v)?.color || '#eee'; }

  // ── Papelera ──
  trashMode = signal(false);
  toggleTrash() {
    this.trashMode.update(m => !m);
    this.expandedId.set(null);
    this.expandedMsg.set(null);
    this.loading.set(true);
    this.load();
  }
  async restorePost(id: number) {
    this.api.restorePostulacion(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }
  async deleteForGood(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('pap.delHard'));
    if (!ok) return;
    this.api.deletePostulacion(id, 'hard').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }
  async emptyTrash() {
    const ok = await this.dialog.confirm(this.i18n.t('pap.vaciarConfirm'));
    if (!ok) return;
    const trashed = await new Promise<Postulacion[]>(resolve => this.api.getPostulaciones({ trashed: true }).subscribe(resolve));
    for (const p of trashed) {
      await new Promise<void>(r => this.api.deletePostulacion(p.id, 'hard').subscribe({ next: () => r(), error: (err) => { markErrorHandled(err); r(); } }));
    }
    this.load();
  }

  filteredCount = computed(() => this.filteredSorted().length);
  focusSearchTick = signal(0);

  setView(v: 'tabla' | 'empresa') {
    this.viewMode.set(v);
    localStorage.setItem('postulatool.hist.view', v);
  }

  filteredSorted(): Postulacion[] {
    let list = [...this.postulaciones()];
    const q = this.filtroGlobal().toLowerCase().trim();
    if (q) {
      list = list.filter(p =>
        p.empresa.toLowerCase().includes(q) || p.oferta_laboral.toLowerCase().includes(q) ||
        p.nombre_empleado.toLowerCase().includes(q) || p.puesto_empleado.toLowerCase().includes(q)
      );
    }
    if (this.checkedCategorias().size < this.categorias.length) {
      list = list.filter(p => p.categoria_id !== null && this.checkedCategorias().has(p.categoria_id));
    }
    list = list.filter(p => {
      const known = this.estados.map(e => e.value).filter(v => v !== this.OTRAS);
      if (known.includes(p.estado)) return this.checkedEstados().has(p.estado);
      return this.checkedEstados().has(this.OTRAS);
    });
    if (this.checkedIdiomas().size < this.idiomas.length) {
      list = list.filter(p => p.idioma && this.checkedIdiomas().has(p.idioma));
    }

    const field = this.sortField();
    const dir = this.sortDir();
    const sortKey = (p: Postulacion): string => {
      const v: any = p[field] ?? '';
      if (field === 'estado') return this.estadoGroupKey(v); // huérfanos y "sin etiqueta" quedan juntos
      return typeof v === 'string' ? v.toLowerCase() : String(v);
    };
    list.sort((a, b) => {
      const av = sortKey(a); const bv = sortKey(b);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }

  toggleSort(field: SortField) {
    if (this.sortField() === field) this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDir.set('asc'); }
  }

  onTableSort(field: string) { this.toggleSort(field as SortField); }

  isSelectedFn = (id: number) => this.selectedIds().has(id);

  formatFecha(f: string) {
    return formatFechaUtil(f);
  }

  toggleExpand(id: number) {
    this.expandedId.update(v => v === id ? null : id);
    this.expandedMsg.set(null);
  }

  toggleMsg(tipo: string) { this.expandedMsg.update(v => v === tipo ? null : tipo); }
  viewPost(id: number) { this.toggleExpand(id); }
  editPost(p: Postulacion) { this.openEditModal(p); }
  copyMsg(text: string) { this.clipboard.copy(text); }

  toggleFav(p: Postulacion) {
    const newVal = p.favorito ? 0 : 1;
    this.api.updatePostulacion(p.id, { favorito: newVal } as any).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.postulaciones.update(list =>
        list.map(x => x.id === p.id ? { ...x, favorito: newVal } : x)
      );
    });
  }

  fixUrl(url: string): string {
    return fixUrlUtil(url);
  }

  // ── Selection mode ──
  toggleSelectionMode() {
    const next = !this.selectionMode();
    this.selectionMode.set(next);
    if (!next) this.selectedIds.set(new Set());
  }

  toggleSelect(id: number) {
    this.selectedIds.update(ids => {
      const n = new Set(ids);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  selectAll() {
    const visible = this.filteredSorted();
    this.selectedIds.set(new Set(visible.map(p => p.id)));
  }

  async applyBulk() {
    const count = this.selectedIds().size;
    if (count === 0) return;
    const estadoLabel = this.estadoLabel(this.bulkEstado);
    const ok = await this.dialog.confirm(this.i18n.t('hist.bulkConfirm', { count, estado: estadoLabel }));
    if (!ok) return;

    const ids = [...this.selectedIds()];
    let done = 0;
    for (const id of ids) {
      await new Promise<void>(resolve => {
        this.api.updatePostulacion(id, { estado: this.bulkEstado } as any).subscribe({ next: () => { done++; resolve(); }, error: (err) => { markErrorHandled(err); resolve(); } });
      });
    }
    this.dialog.toast(this.i18n.t('hist.bulkDone', { count: done }));
    this.selectedIds.set(new Set());
    this.selectionMode.set(false);
    this.load();
  }

  async bulkDelete() {
    const count = this.selectedIds().size;
    if (count === 0) return;
    const ok = await this.dialog.confirm(this.i18n.t('hist.bulkDeleteConfirm', { count }));
    if (!ok) return;

    const ids = [...this.selectedIds()];
    let done = 0;
    for (const id of ids) {
      await new Promise<void>(resolve => {
        this.api.deletePostulacion(id).subscribe({ next: () => { done++; resolve(); }, error: (err) => { markErrorHandled(err); resolve(); } });
      });
    }
    this.dialog.toast(this.i18n.t('hist.bulkDeleteDone', { count: done }));
    this.selectedIds.set(new Set());
    this.selectionMode.set(false);
    this.load();
  }

  // ── Single edit ──
  async deletePost(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('hist.deleteConfirm'));
    if (!ok) return;
    this.api.deletePostulacion(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.expandedId.set(null); this.load(); });
  }

  openEditModal(p: Postulacion) {
    this.editId = p.id;
    // Un estado que no es tag conocida (p. ej. SIN_ETIQUETA importado) no es opción del <select>;
    // se ofrece el default para que el select no quede vacío.
    const conocido = this.estados.some(e => String(e.value) === (p.estado || DEFAULT_ESTADO) && String(e.value) !== this.OTRAS);
    const estadoInicial = conocido ? (p.estado || DEFAULT_ESTADO) : DEFAULT_ESTADO;
    this.editForm = {
      empresa: p.empresa,
      oferta_laboral: p.oferta_laboral,
      nombre_empleado: p.nombre_empleado,
      puesto_empleado: p.puesto_empleado,
      estado: estadoInicial,
      link_empresa: this.empresaLink(p.empresa) || '',
      contacto_empleado: p.contacto_empleado || '',
      notas: p.notas || '',
    };
    this.editUsed.set(new Set(Object.keys(p.valores_usados || {})));
    const opts = new Set<string>();
    for (const e of this.empresas()) opts.add(e.nombre);
    if (!opts.has(p.empresa)) opts.add(p.empresa);
    this.editEmpresaOptions = [...opts];
    this.editLinkOriginal = this.empresaLink(p.empresa) || '';
    this.editModal.set(true);
  }

  closeEditModal() { this.editModal.set(false); this.editId = null; }

  onEditEmpresaChange(nombre: string) {
    this.editForm.empresa = nombre;
    this.editForm.link_empresa = this.empresaLink(nombre) || '';
  }

  stagger(i: number): string {
    return staggerUtil(i);
  }

  async saveEdit() {
    if (this.editId === null) return;
    const linkNuevo = (this.editForm.link_empresa || '').trim();
    const prev = this.postulaciones().find(x => x.id === this.editId);
    const empresaNom = (this.editForm.empresa || '').trim();
    const payload: any = {
      empresa: empresaNom,
      estado: this.editForm.estado,
      notas: this.editForm.notas,
      contacto_empleado: (this.editForm.contacto_empleado || '').trim(),
    };
    if (this.editUsed().has('oferta_laboral')) payload.oferta_laboral = (this.editForm.oferta_laboral || '').trim();
    if (this.editUsed().has('nombre_empleado')) payload.nombre_empleado = (this.editForm.nombre_empleado || '').trim();
    if (this.editUsed().has('puesto_empleado')) payload.puesto_empleado = (this.editForm.puesto_empleado || '').trim();
    if (prev && prev.empresa !== empresaNom) payload.link_empresa = linkNuevo;

    const linkPropaga = this.empresaLink(empresaNom);
    const linkCambio = linkNuevo !== (linkPropaga || '');

    if (linkCambio) {
      const n = this.postulaciones().filter(x => x.empresa === empresaNom).length;
      const ok = await this.dialog.confirm(this.i18n.t('hist.linkChangeConfirm', {
        empresa: empresaNom,
        count: n,
        from: linkPropaga || '—',
        to: linkNuevo || '—',
      }));
      if (!ok) {
        this.editForm.link_empresa = linkPropaga || '';
        return;
      }
      const e = this.findEmpresa(empresaNom);
      if (e) await new Promise<void>(r => this.api.updateEmpresa(e.id, { link: linkNuevo }).subscribe({ next: () => r(), error: (err) => { markErrorHandled(err); r(); } }));
      this.shared.empresasRefresh.update(v => v + 1);
    }

    this.api.updatePostulacion(this.editId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.closeEditModal();
        this.load();
      },
      error: () => this.dialog.toast(this.i18n.t('common.error.save'), 'error'),
    });
  }
}
