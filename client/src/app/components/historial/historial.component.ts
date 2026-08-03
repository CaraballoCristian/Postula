import { Component, OnInit, signal, computed, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { Postulacion, Categoria, ESTADOS, Tag } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';

type SortField = 'fecha' | 'empresa' | 'categoria_id' | 'idioma' | 'oferta_laboral' | 'nombre_empleado' | 'puesto_empleado' | 'favorito' | 'estado';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- FILTROS + BATCH ACTIONS -->
    <div class="flex flex-col gap-2 mb-4">
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        
      <div class="relative sm:w-4/12">
          <input [ngModel]="filtroGlobal()" (ngModelChange)="filtroGlobal.set($event)" [placeholder]="i18n.t('hist.buscar')" class="text-sm w-full pr-7" />
          @if (filtroGlobal()) {
            <button class="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs border-0 cursor-pointer bg-transparent" style="opacity: 0.4; color: var(--text);" (click)="filtroGlobal.set('')" [title]="i18n.t('hist.limpiar')">×</button>
          }
        </div>
        <div class="relative w-3/12">
          <button class="text-sm flex items-center justify-between pl-2 pr-1 py-2 rounded-md cursor-pointer border w-full" style="border-color: var(--border); background: var(--surface); color: var(--text);" (click)="toggleDropdown('cat'); $event.stopPropagation()">
            <span>{{ i18n.t('hist.categorias') }}</span>
            <span>▾</span>
          </button>
          @if (openDropdown() === 'cat') {
            <div class="absolute top-full left-0 mt-1 z-20 card p-1 w-full shadow-lg" (click)="$event.stopPropagation()">
              @for (c of categorias; track c.id) {
                <label class="flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer text-sm" [style.background]="checkedCategorias().has(c.id) ? 'var(--surface-hover)' : 'transparent'">
                  <input type="checkbox" [checked]="checkedCategorias().has(c.id)" (change)="toggleCategoria(c.id)" class="w-3.5 h-3.5" style="accent-color: var(--accent);" />
                  {{ i18n.categoriaLabel(c.nombre) }}
                </label>
              }
            </div>
          }
        </div>
        <div class="relative w-3/12">
          <button class="text-sm flex items-center justify-between pl-2 pr-1 py-2 rounded-md cursor-pointer border w-full" style="border-color: var(--border); background: var(--surface); color: var(--text);" (click)="toggleDropdown('est'); $event.stopPropagation()">
            <span>{{ i18n.t('hist.estados') }}</span>
            <span>▾</span>
          </button>
          @if (openDropdown() === 'est') {
            <div class="absolute top-full left-0 mt-1 z-20 card p-1 w-full shadow-lg" (click)="$event.stopPropagation()">
              @for (e of estados; track e.value) {
                <label class="flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer text-sm" [style.background]="checkedEstados().has(e.value) ? 'var(--surface-hover)' : 'transparent'">
                  <input type="checkbox" [checked]="checkedEstados().has(e.value)" (change)="toggleEstado(e.value)" class="w-3.5 h-3.5" style="accent-color: var(--accent);" />
                  {{ estadoLabel(e.value) }}
                </label>
              }
            </div>
          }
        </div>
        <div class="relative w-2/12">
            <button class="text-sm flex items-center justify-between pl-2 pr-1 py-2 rounded-md cursor-pointer border w-full" style="border-color: var(--border); background: var(--surface); color: var(--text);" (click)="toggleDropdown('idioma'); $event.stopPropagation()">
              <span>{{ i18n.t('hist.idiomas') }}</span>
              <span>▾</span>
            </button>
            @if (openDropdown() === 'idioma') {
              <div class="absolute top-full left-0 mt-1 z-20 card p-1 w-full shadow-lg" (click)="$event.stopPropagation()">
                @for (i of idiomas; track i) {
                  <label class="flex items-center gap-2.5 px-2.5 py-1.5 rounded cursor-pointer text-sm" [style.background]="checkedIdiomas().has(i) ? 'var(--surface-hover)' : 'transparent'">
                    <input type="checkbox" [checked]="checkedIdiomas().has(i)" (change)="toggleIdioma(i)" class="w-3.5 h-3.5" style="accent-color: var(--accent);" />
                    {{ i }}
                  </label>
                }
              </div>
            }
          </div>
      </div>
      

      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <label class="toggle-pill" [class.active]="selectionMode()" (click)="toggleSelectionMode()">
          {{ i18n.t('hist.seleccionMultiple') }}
        </label>

        @if (selectionMode()) {
          <div class="hidden sm:flex gap-2 sm:gap-3 items-center">
            <button class="toggle-pill" (click)="selectAll()">{{ i18n.t('hist.seleccionarTodo') }}</button>
            <select [(ngModel)]="bulkEstado" class="text-sm sm:w-auto">
              @for (e of estados; track e.value) { @if (e.value !== '__otras__') { <option [value]="e.value">{{ estadoLabel(e.value) }}</option> } }
            </select>
            @if (selectedIds().size > 0) {
              <button class="btn btn-md h-full" style="background: #dc2626; color: #fff;" (click)="applyBulk()">{{ i18n.t('hist.aplicarA', { count: selectedIds().size }) }}</button>
              <button class="btn btn-md h-full" style="background: #6b7280; color: #fff;" (click)="bulkDelete()" title="{{ i18n.t('pap.ver') }}">🗑️</button>
            }
          </div>
        }

        <span class="text-xs ml-auto" style="opacity: 0.4;">{{ i18n.t('hist.resultado', { count: filteredCount() }) }}</span>

        <button class="toggle-pill" [class.active]="trashMode()" [title]="i18n.t('pap.ver')" (click)="toggleTrash()">🗑️</button>

        @if (selectionMode()) {
          <div class="flex sm:hidden flex-col gap-2 w-full">
            <div class="flex gap-2">
              <button class="toggle-pill" (click)="selectAll()">{{ i18n.t('hist.seleccionarTodo') }}</button>
              <select [(ngModel)]="bulkEstado" class="text-sm flex-1">
                @for (e of estados; track e.value) { @if (e.value !== '__otras__') { <option [value]="e.value">{{ estadoLabel(e.value) }}</option> } }
              </select>
            </div>
            @if (selectedIds().size > 0) {
              <button class="btn btn-sm py-2" style="background: #dc2626; color: #fff; flex: 1;" (click)="applyBulk()">{{ i18n.t('hist.aplicarA', { count: selectedIds().size }) }}</button>
              <button class="btn btn-sm py-2" style="background: #6b7280; color: #fff;" (click)="bulkDelete()" title="{{ i18n.t('pap.ver') }}">🗑️</button>
            }
          </div>
        }
        </div>
        
      </div>

    @if (loading()) {
      <div class="card text-center py-12 flex items-center justify-center gap-2" style="opacity: 0.5;">
        <span class="loader"></span> {{ i18n.t('common.loading') }}
      </div>
    } @else if (postulaciones().length === 0) {
      <div class="card flex items-center justify-center py-12" style="opacity: 0.35;">
        <span>{{ trashMode() ? i18n.t('pap.empty') : i18n.t('hist.sinPostulaciones') }}</span>
      </div>
    } @else {
      @if (trashMode()) {
        <div class="flex justify-end mb-2">
          <button class="btn btn-outline btn-sm" (click)="emptyTrash()">{{ i18n.t('pap.vaciar') }}</button>
        </div>
      }
      <div class="card" style="padding: 0;">
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                @if (selectionMode()) { <th class="px-3 py-2.5 w-8"></th> }
                @for (col of columns; track col.field) {
                  <th class="text-left px-3 py-2.5 font-medium cursor-pointer select-none text-xs" style="opacity: 0.5; border-left: 1px solid var(--border);" (click)="toggleSort(col.field)">
                    <span class="inline-flex items-center gap-1">{{ i18n.t(col.labelKey) }} @if (sortField() === col.field) { <span class="text-[10px]">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }</span>
                  </th>
                }
                <th class="px-3 py-2.5" style="border-left: 1px solid var(--border);"></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filteredSorted(); track p.id) {
                <tr class="cursor-pointer transition-colors" style="border-bottom: 1px solid var(--border);" [style.background-color]="expandedId() === p.id ? 'var(--surface-hover)' : (hoverRow === p.id ? 'var(--surface-hover)' : 'transparent')" (mouseenter)="hoverRow = p.id" (mouseleave)="hoverRow = null">
                  @if (selectionMode()) {
                    <td class="px-3 py-2.5" (click)="$event.stopPropagation()">
                      <input type="checkbox" [checked]="selectedIds().has(p.id)" (change)="toggleSelect(p.id)" class="w-3.5 h-3.5" style="accent-color: var(--accent);" />
                    </td>
                  }
                  <td class="px-3 py-2.5 text-center" (click)="toggleFav(p); $event.stopPropagation()" [title]="i18n.t('hist.titFavorito')">
                    <span class="cursor-pointer select-none">{{ p.favorito ? '⭐' : '☆' }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-xs" style="opacity: 0.45; white-space: nowrap; border-left: 1px solid var(--border);">{{ formatFecha(p.fecha) }}</td>
                  <td class="px-3 py-2.5 font-medium" style="white-space: nowrap; border-left: 1px solid var(--border);">
                    <span style="display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.empresa }}</span>
                    @if (p.link_empresa) {
                      <a [href]="fixUrl(p.link_empresa)" target="_blank" rel="noopener" class="ml-1 no-underline" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                    }
                  </td>
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">
                    @if (p.categoria_id) { <span class="badge text-[0.65rem]" style="background: var(--accent); color: #fff;">{{ catNombre(p.categoria_id) }}</span> }
                  </td>
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">{{ p.idioma || '' }}</td>
                  <td class="px-3 py-2.5" style="max-width: 90px; white-space: nowrap; border-left: 1px solid var(--border);"><span style="display: inline-block; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.oferta_laboral }}</span></td>
                  <td class="px-3 py-2.5" style="white-space: nowrap; border-left: 1px solid var(--border);">
                    <span style="display: inline-block; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.nombre_empleado }}</span>
                    @if (p.contacto_empleado) {
                      <a [href]="fixUrl(p.contacto_empleado)" target="_blank" rel="noopener" class="ml-1 no-underline" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                    }
                  </td>
                  <td class="px-3 py-2.5" style="white-space: nowrap; border-left: 1px solid var(--border);"><span style="display: inline-block; max-width: 75px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.puesto_empleado }}</span></td>
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">
                    <span class="badge text-[0.65rem]" [style.background-color]="estadoColor(p.estado)" [style.color]="p.estado === 'solicitado' ? '' : '#fff'">{{ estadoLabel(p.estado) }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right" style="border-left: 1px solid var(--border);">
                    <div class="flex gap-1 justify-end">
                      @if (trashMode()) {
                        <button class="btn btn-ghost btn-sm" (click)="restorePost(p.id)" [title]="i18n.t('pap.restore')">↩️</button>
                        <button class="btn btn-ghost btn-sm" (click)="deleteForGood(p.id)" [title]="i18n.t('pap.delHard')">🗑️</button>
                      } @else {
                        <button class="btn btn-ghost btn-sm" (click)="viewPost(p.id)" [title]="i18n.t('hist.verMensajes')">👁</button>
                        <button class="btn btn-ghost btn-sm" (click)="editPost(p)" [title]="i18n.t('common.edit')">✏️</button>
                        <button class="btn btn-ghost btn-sm" (click)="deletePost(p.id)" [title]="i18n.t('common.delete')">🗑️</button>
                      }
                    </div>
                  </td>
                </tr>
                @if (expandedId() === p.id) {
                  <tr>
                    <td [attr.colspan]="selectionMode() ? 11 : 10" class="px-4 py-3">
                      <div class="space-y-2">
                        @if (p.link_empresa) {
                          <div class="text-xs"><a [href]="fixUrl(p.link_empresa)" target="_blank" rel="noopener" style="color: var(--accent);">🔗 {{ p.link_empresa }}</a></div>
                        }
                        @if (p.contacto_empleado) {
                          <div class="text-xs"><a [href]="fixUrl(p.contacto_empleado)" target="_blank" rel="noopener" style="color: var(--accent);">👤 {{ p.contacto_empleado }}</a></div>
                        }
                        @if (p.notas) {
                          <p class="text-xs" style="opacity: 0.55; white-space: pre-wrap;">{{ p.notas }}</p>
                        }
                        @for (tipo of msgTipos; track tipo) {
                          @if (tipo === 'email' && p.resultado_email) {
                            <div class="animate-fade-in" style="border: 1px solid var(--border); border-radius: 0.375rem; overflow: hidden;">
                              <div class="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'email' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('email')">
                                <span class="flex-1 font-medium">✉ {{ i18n.t('hist.expEmail') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'email' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_email!)" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'email') {
                                <div style="border-top: 1px solid var(--border);"><pre class="text-xs whitespace-pre-wrap font-sans leading-relaxed px-3 py-2" style="margin: 0;">{{ p.resultado_email }}</pre></div>
                              }
                            </div>
                          }
                          @if (tipo === 'mensaje_empresa' && p.resultado_empresa) {
                            <div class="animate-fade-in" style="border: 1px solid var(--border); border-radius: 0.375rem; overflow: hidden;">
                              <div class="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'mensaje_empresa' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('mensaje_empresa')">
                                <span class="flex-1 font-medium">🏢 {{ i18n.t('hist.expEmpresa') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'mensaje_empresa' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_empresa!)" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'mensaje_empresa') {
                                <div style="border-top: 1px solid var(--border);"><pre class="text-xs whitespace-pre-wrap font-sans leading-relaxed px-3 py-2" style="margin: 0;">{{ p.resultado_empresa }}</pre></div>
                              }
                            </div>
                          }
                          @if (tipo === 'mensaje_recruiter' && p.resultado_recruiter) {
                            <div class="animate-fade-in" style="border: 1px solid var(--border); border-radius: 0.375rem; overflow: hidden;">
                              <div class="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'mensaje_recruiter' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('mensaje_recruiter')">
                                <span class="flex-1 font-medium">👤 {{ i18n.t('hist.expRecruiter') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'mensaje_recruiter' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_recruiter!)" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'mensaje_recruiter') {
                                <div style="border-top: 1px solid var(--border);"><pre class="text-xs whitespace-pre-wrap font-sans leading-relaxed px-3 py-2" style="margin: 0;">{{ p.resultado_recruiter }}</pre></div>
                              }
                            </div>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- EDIT MODAL -->
    @if (editModal()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" style="background: rgba(0,0,0,0.3);">
        <div class="card w-full max-w-lg mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ i18n.t('hist.editTitle') }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.empresa') }}</label><input [(ngModel)]="editForm.empresa" class="text-sm" /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.oferta') }}</label><input [(ngModel)]="editForm.oferta_laboral" class="text-sm" /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.reclutador') }}</label><input [(ngModel)]="editForm.nombre_empleado" class="text-sm" /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.puestoRecl') }}</label><input [(ngModel)]="editForm.puesto_empleado" class="text-sm" /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.estado') }}</label>
              <select [(ngModel)]="editForm.estado" class="text-sm">
                @for (e of estados; track e.value) { @if (e.value !== '__otras__') { <option [value]="e.value">{{ estadoLabel(e.value) }}</option> } }
              </select>
            </div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.linkEmpresa') }}</label><input [(ngModel)]="editForm.link_empresa" class="text-sm" placeholder="https://..." /></div>
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.contactoEmpleado') }}</label><input [(ngModel)]="editForm.contacto_empleado" class="text-sm" placeholder="https://linkedin.com/..." /></div>
            <div class="col-span-2"><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.notas') }}</label><textarea [(ngModel)]="editForm.notas" rows="3" class="text-sm" placeholder="Notas"></textarea></div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeEditModal()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveEdit()">{{ i18n.t('common.save') }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class HistorialComponent implements OnInit {
  postulaciones = signal<Postulacion[]>([]);
  filtroGlobal = signal('');
  categorias: Categoria[] = [];
  checkedCategorias = signal<Set<number>>(new Set());
  checkedEstados = signal<Set<string>>(new Set());
  idiomas: string[] = [];
  checkedIdiomas = signal<Set<string>>(new Set());
  openDropdown = signal<'cat' | 'est' | 'idioma' | null>(null);
  sortField = signal<SortField>('fecha');
  sortDir = signal<'asc' | 'desc'>('desc');
  expandedId = signal<number | null>(null);
  expandedMsg = signal<string | null>(null);
  hoverRow: number | null = null;
  estados = ESTADOS;
  msgTipos = ['email', 'mensaje_empresa', 'mensaje_recruiter'];
  editModal = signal(false);
  editForm: any = {};
  private editId: number | null = null;

  // Bulk selection
  selectionMode = signal(false);
  selectedIds = signal<Set<number>>(new Set());
  bulkEstado = 'solicitado';

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

  private catNombres: Record<number, string> = {};
  loaded = signal(false);
  loading = signal(false);
  private inited = false;
  private readonly OTRAS = '__otras__';

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
    effect(() => {
      if (this.shared.activeTab() === 'historial' && !this.loaded()) {
        this.initData();
        this.loaded.set(true);
      }
    });
    effect(() => this.persistFilters());
    document.addEventListener('click', () => this.openDropdown.set(null));
  }

  @HostListener('document:keydown.escape')
  onEsc() {
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

  ngOnInit() {}

  initData() {
    this.restoreFilters();
    this.loading.set(true);
    let done = 0;
    const checkDone = () => { if (++done >= 4) this.loading.set(false); };
    this.loadCategorias(checkDone);
    this.loadTags(checkDone);
    this.loadIdiomas(checkDone);
    this.api.getPostulaciones().subscribe(d => { this.postulaciones.set(d); checkDone(); });
    this.inited = true;
  }

  load() { this.api.getPostulaciones({ trashed: this.trashMode() }).subscribe(d => this.postulaciones.set(d)); }

  loadCategorias(onDone?: () => void) {
    this.api.getCategorias().subscribe(d => {
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
    this.api.getIdiomas().subscribe(d => {
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
    this.api.getTags().subscribe(d => {
      const oldChecked = new Set(this.checkedEstados());
      const oldNames = new Set(this.estados.map(e => e.value));
      this.estados = d.map(t => ({ value: t.nombre, label: this.i18n.tagLabel(t.nombre), color: t.color }));
      if (d.length === 0) {
        for (const e of ESTADOS) this.estados.push({ value: e.value, label: e.label, color: e.color });
      }
      this.estados.push({ value: this.OTRAS, label: this.i18n.t('hist.sinEtiqueta'), color: 'var(--surface-hover)' });
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
  estadoColor(v: string) { return this.estados.find(e => e.value === v)?.color || 'var(--surface-hover)'; }

  // ── Papelera ──
  trashMode = signal(false);
  toggleTrash() {
    this.trashMode.update(m => !m);
    this.load();
  }
  async restorePost(id: number) {
    this.api.restorePostulacion(id).subscribe(() => this.load());
  }
  async deleteForGood(id: number) {
    const ok = await this.dialog.confirm(this.i18n.t('pap.delHard'));
    if (!ok) return;
    this.api.deletePostulacion(id, 'hard').subscribe(() => this.load());
  }
  async emptyTrash() {
    const ok = await this.dialog.confirm(this.i18n.t('pap.vaciarConfirm'));
    if (!ok) return;
    const trashed = await new Promise<Postulacion[]>(resolve => this.api.getPostulaciones({ trashed: true }).subscribe(resolve));
    for (const p of trashed) {
      await new Promise<void>(r => this.api.deletePostulacion(p.id, 'hard').subscribe({ next: () => r(), error: () => r() }));
    }
    this.load();
  }

  toggleDropdown(type: 'cat' | 'est' | 'idioma') {
    this.openDropdown.update(v => v === type ? null : type);
  }

  toggleCategoria(id: number) {
    this.checkedCategorias.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  toggleEstado(val: string) {
    this.checkedEstados.update(s => { const n = new Set(s); if (n.has(val)) n.delete(val); else n.add(val); return n; });
  }

  toggleIdioma(nombre: string) {
    this.checkedIdiomas.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }

  filteredCount = computed(() => this.filteredSorted().length);

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
    list.sort((a, b) => {
      let av: any = a[field] ?? ''; let bv: any = b[field] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
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

  formatFecha(f: string) {
    const d = f.substring(0, 10); // "2026-07-31"
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y.substring(2)}`; // "31-07-26"
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
    this.api.updatePostulacion(p.id, { favorito: newVal } as any).subscribe(() => {
      this.postulaciones.update(list =>
        list.map(x => x.id === p.id ? { ...x, favorito: newVal } : x)
      );
    });
  }

  fixUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return 'https://' + url;
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
        this.api.updatePostulacion(id, { estado: this.bulkEstado } as any).subscribe({ next: () => { done++; resolve(); }, error: () => resolve() });
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
        this.api.deletePostulacion(id).subscribe({ next: () => { done++; resolve(); }, error: () => resolve() });
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
    this.api.deletePostulacion(id).subscribe(() => { this.expandedId.set(null); this.load(); });
  }

  openEditModal(p: Postulacion) {
    this.editId = p.id;
    this.editForm = {
      empresa: p.empresa,
      oferta_laboral: p.oferta_laboral,
      nombre_empleado: p.nombre_empleado,
      puesto_empleado: p.puesto_empleado,
      estado: p.estado || 'solicitado',
      link_empresa: p.link_empresa || '',
      contacto_empleado: p.contacto_empleado || '',
      notas: p.notas || '',
    };
    this.editModal.set(true);
  }

  closeEditModal() { this.editModal.set(false); this.editId = null; }

  saveEdit() {
    if (this.editId === null) return;
    this.api.updatePostulacion(this.editId, this.editForm).subscribe(() => {
      this.closeEditModal();
      this.load();
    });
  }
}
