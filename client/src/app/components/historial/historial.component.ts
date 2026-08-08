import { Component, OnInit, signal, computed, effect, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DialogService } from '../../services/dialog.service';
import { SharedStateService } from '../../services/shared-state.service';
import { Postulacion, Categoria, ESTADOS, Tag, Empresa } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';
import { PostulacionTableComponent } from '../postulacion-table/postulacion-table.component';
import { EmpresaGrupo, groupByEmpresa } from '../../utils/grouping';

type SortField = 'fecha' | 'empresa' | 'categoria_id' | 'idioma' | 'oferta_laboral' | 'nombre_empleado' | 'puesto_empleado' | 'favorito' | 'estado';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [FormsModule, DragDropModule, PostulacionTableComponent],
  template: `
    <!-- FILTROS + BATCH ACTIONS -->
    <div class="sticky top-0 z-20 mb-4 rounded-b-md" style="background-color: var(--surface); border-bottom: 1px solid var(--border); padding-top: 1.25rem; padding-bottom: 0.75rem;">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        
      <div class="relative sm:w-4/12">
          <input [ngModel]="filtroGlobal()" (ngModelChange)="filtroGlobal.set($event)" [placeholder]="i18n.t('hist.buscar')" class="text-sm w-full pr-7" />
          @if (filtroGlobal()) {
            <button class="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs border-0 cursor-pointer bg-transparent" style="opacity: 0.4; color: var(--text);" (click)="filtroGlobal.set('')" [title]="i18n.t('hist.limpiar')">×</button>
          }
        </div>
        <div class="relative w-full sm:w-3/12">
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
        <div class="relative w-full sm:w-3/12">
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
        <div class="relative w-full sm:w-2/12">
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

        @if (!trashMode()) {
          <div class="flex items-center gap-0.5 p-0.5 border rounded-md" style="border-color: var(--border); background: var(--surface);">
            <button class="view-pill" [class.active]="viewMode() === 'tabla'" (click)="setView('tabla')">☰ {{ i18n.t('hist.tabla') }}</button>
            <button class="view-pill" [class.active]="viewMode() === 'empresa'" (click)="setView('empresa')">▣ {{ i18n.t('hist.porEmpresa') }}</button>
          </div>
        }

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
      @if (viewMode() === 'tabla' || trashMode()) {
      <app-postulacion-table
        [rows]="filteredSorted()"
        [columns]="columns"
        [selectionMode]="selectionMode()"
        [trashMode]="trashMode()"
        [sortField]="sortField()"
        [sortDir]="sortDir()"
        [expandedId]="expandedId()"
        [expandedMsg]="expandedMsg()"
        [estados]="estados"
        [catNombres]="catNombres"
        [isSelected]="isSelectedFn"
        (toggleFav)="toggleFav($event)"
        (toggleSelect)="toggleSelect($event)"
        (toggleSort)="onTableSort($event)"
        (view)="viewPost($event)"
        (edit)="editPost($event)"
        (delete)="deletePost($event)"
        (restore)="restorePost($event)"
        (deleteForGood)="deleteForGood($event)"
        (toggleMsg)="toggleMsg($event)"
        (copy)="copyMsg($event)"
      />
      } @else if (viewMode() === 'empresa') {
      <!-- POR EMPRESA -->
      <div class="card" style="padding: 0;">
        <div class="flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer select-none" style="opacity: 0.5; border-bottom: 1px solid var(--border);" (click)="toggleEmpresaSort()">
          <span class="inline-flex items-center gap-1 font-medium">{{ i18n.t('hist.porEmpresa') }} <span class="text-[10px]">{{ empresaSortDir() === 'asc' ? '▲' : '▼' }}</span></span>
        </div>
        <div class="p-2 space-y-2">
          @for (g of grupos(); track g.nombre) {
            <div style="border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden;">
              <div class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" [style.background-color]="openEmpresas().has(g.nombre) ? 'var(--surface-hover)' : 'transparent'" (click)="toggleEmpresa(g.nombre)">
                <span class="text-xs shrink-0" style="opacity: 0.6;">{{ openEmpresas().has(g.nombre) ? '▼' : '▶' }}</span>
                @if (hasFavorita(g)) { <span class="text-sm shrink-0 leading-none" style="color: #f5c518;" title="{{ i18n.t('hist.favorita') }}">★</span> }
                <span class="text-sm font-semibold flex-1 truncate">{{ g.nombre }}</span>
                <span class="text-xs shrink-0" style="opacity: 0.45;">{{ postCountLabel(g.items.length) }}</span>
                <div class="flex gap-1 shrink-0" (click)="$event.stopPropagation()">
                  <button class="btn btn-ghost btn-sm" (click)="openEmpresaLinkModal(g.nombre)" [title]="i18n.t('hist.editEmpresaLink')">✏️</button>
                  <button class="btn btn-ghost btn-sm" (click)="deleteEmpresaGroup(g)" [title]="i18n.t('common.delete')">🗑️</button>
                </div>
              </div>
              @if (openEmpresas().has(g.nombre)) {
                <div class="animate-fade-in" style="border-top: 1px solid var(--border);">
                  @if (empresaLink(g.nombre)) {
                    <div class="flex items-center gap-1.5 px-3 py-2 text-xs" style="border-bottom: 1px solid var(--border);">
                      <span class="shrink-0" style="opacity: 0.6;">🔗</span>
                      <a [href]="fixUrl(empresaLink(g.nombre))" target="_blank" rel="noopener" class="no-underline truncate" style="color: var(--accent);" [title]="empresaLink(g.nombre)">{{ empresaLink(g.nombre) }}</a>
                    </div>
                  }
                  @if (getEmpresaMensaje(g.nombre)) {
                    <div class="text-xs" style="border-bottom: 1px solid var(--border);">
                      <div class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" [style.background-color]="openEmpresaMensajes().has(g.nombre) ? 'var(--surface-hover)' : 'transparent'" (click)="toggleEmpresaMensaje(g.nombre)">
                        <span class="flex-1 font-medium">🏢 {{ i18n.t('hist.expEmpresa') }}</span>
                        <span style="opacity: 0.4;">{{ openEmpresaMensajes().has(g.nombre) ? '▲' : '▼' }}</span>
                        <button class="btn btn-ghost btn-sm text-xs shrink-0" (click)="copyMsg(getEmpresaMensaje(g.nombre)!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                      </div>
                      @if (openEmpresaMensajes().has(g.nombre)) {
                        <div style="border-top: 1px solid var(--border);"><pre class="text-xs whitespace-pre-wrap font-sans leading-relaxed px-3 py-2" style="margin: 0;">{{ getEmpresaMensaje(g.nombre) }}</pre></div>
                      }
                    </div>
                  }
                  <app-postulacion-table
                    [rows]="g.items"
                    [columns]="empresaTableColumns"
                    [selectionMode]="selectionMode()"
                    [trashMode]="false"
                    [sortField]="sortField()"
                    [sortDir]="sortDir()"
                    [expandedId]="expandedId()"
                    [expandedMsg]="expandedMsg()"
                    [estados]="estados"
                    [catNombres]="catNombres"
                    [isSelected]="isSelectedFn"
                    [hideEmpresaLink]="true"
                    (toggleFav)="toggleFav($event)"
                    (toggleSelect)="toggleSelect($event)"
                    (toggleSort)="onTableSort($event)"
                    (view)="viewPost($event)"
                    (edit)="editPost($event)"
                    (delete)="deletePost($event)"
                    (toggleMsg)="toggleMsg($event)"
                    (copy)="copyMsg($event)"
                  />
                </div>
              }
            </div>
          }
          @if (grupos().length === 0) {
            <div class="text-center py-10" style="opacity: 0.35;">{{ i18n.t('hist.sinGrupos') }}</div>
          }
        </div>
      </div>
      } @else if (viewMode() === 'kanban' && false) {
      <!-- KANBAN (deshabilitado; se mantiene el código por si se reactiva) -->
      <div class="overflow-x-auto" style="overflow-y: hidden; padding-bottom: 8px;">
        <div class="flex items-start gap-3" cdkDropListGroup>
          @for (col of kanbanColumns(); track col.value; let ci = $index) {
            <div class="kanban-col animate-stagger" [style.animation-delay]="stagger(ci)" style="min-width: 250px;">
              <div class="flex items-center gap-2 px-2.5 py-2 rounded-t-md" style="background: var(--surface); border: 1px solid var(--border);">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="col.color"></span>
                <span class="text-xs font-semibold flex-1 truncate">{{ col.label }}</span>
                <span class="text-[10px] font-semibold rounded-full px-1.5 py-0.5" style="background: var(--surface-hover);">{{ col.items.length }}</span>
              </div>
              <div cdkDropList [cdkDropListDisabled]="col.value === '__otras__'" (cdkDropListDropped)="onKanbanDrop($event, col.value)" class="kanban-body">
                @for (p of col.items; track p.id; let i = $index) {
                  <div class="kanban-card animate-stagger" [style.animation-delay]="stagger(i)" cdkDrag [cdkDragData]="p">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="cursor-pointer select-none text-xs" (click)="toggleFav(p); $event.stopPropagation()" [title]="i18n.t('hist.titFavorito')">{{ p.favorito ? '⭐' : '☆' }}</span>
                        <span class="text-xs font-semibold truncate cursor-pointer" (click)="editPost(p)" [title]="p.empresa">{{ p.empresa }}</span>
                        @if (p.link_empresa) {
                          <a [href]="fixUrl(p.link_empresa)" target="_blank" rel="noopener" class="no-underline shrink-0" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                        }
                      </div>
                      @if (p.categoria_id) {
                        <span class="badge kanban-badge shrink-0" style="background: var(--accent); color: var(--accent-contrast, #fff);">{{ catNombre(p.categoria_id) }}</span>
                      }
                    </div>
                    <p class="text-xs truncate mt-1" [title]="p.oferta_laboral">{{ p.oferta_laboral || '—' }}</p>
                    <div class="flex items-center justify-between gap-2 mt-1">
                      <div class="flex items-center gap-1 min-w-0 truncate">
                        @if (p.nombre_empleado) { <span class="text-xs truncate">👤 {{ p.nombre_empleado }}</span> }
                        @if (p.contacto_empleado) {
                          <a [href]="fixUrl(p.contacto_empleado)" target="_blank" rel="noopener" class="no-underline shrink-0" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                        }
                        @if (p.puesto_empleado) { <span class="text-xs truncate" style="opacity: 0.55;">— {{ p.puesto_empleado }}</span> }
                      </div>
                      @if (p.idioma) { <span class="text-[10px] uppercase shrink-0" style="opacity: 0.45;">{{ p.idioma }}</span> }
                    </div>
                    <div style="border-top: 1px solid var(--border); margin-top: 0.5rem;"></div>
                    <div class="flex items-center justify-between pt-1.5">
                      <span class="text-[10px]" style="opacity: 0.45;">{{ formatFecha(p.fecha) }}</span>
                      <div class="flex items-center gap-2">
                        <button class="btn btn-ghost btn-sm text-xs" (click)="viewPost(p.id)" [title]="i18n.t('hist.verMensajes')">👁</button>
                        <button class="btn btn-ghost btn-sm text-xs" (click)="editPost(p)" [title]="i18n.t('common.edit')">✏️</button>
                        <button class="btn btn-ghost btn-sm text-xs" (click)="deletePost(p.id)" [title]="i18n.t('common.delete')">🗑️</button>
                      </div>
                    </div>
                    @if (expandedId() === p.id) {
                      <div class="mt-1.5 px-2 py-1.5 space-y-1.5 text-[11px]" style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 0.375rem;">
                        @if (p.link_empresa) { <div class="truncate"><a [href]="fixUrl(p.link_empresa)" target="_blank" rel="noopener" style="color: var(--accent);">🔗 {{ p.link_empresa }}</a></div> }
                        @if (p.contacto_empleado) { <div class="truncate"><a [href]="fixUrl(p.contacto_empleado)" target="_blank" rel="noopener" style="color: var(--accent);">👤 {{ p.contacto_empleado }}</a></div> }
                        @if (p.notas) { <p style="opacity: 0.6; white-space: pre-wrap;">{{ p.notas }}</p> }
                        @for (tipo of msgTipos; track tipo) {
                          @if (tipo === 'email' && p.resultado_email) {
                            <div style="border: 1px solid var(--border); border-radius: 0.25rem; overflow: hidden;">
                              <div class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'email' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('email')">
                                <span class="flex-1 font-medium">✉ {{ i18n.t('hist.expEmail') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'email' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_email!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'email') { <div style="border-top: 1px solid var(--border);"><pre class="text-[11px] whitespace-pre-wrap font-sans leading-relaxed px-2 py-1.5" style="margin: 0;">{{ p.resultado_email }}</pre></div> }
                            </div>
                          }
                          @if (tipo === 'mensaje_empresa' && p.resultado_empresa) {
                            <div style="border: 1px solid var(--border); border-radius: 0.25rem; overflow: hidden;">
                              <div class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'mensaje_empresa' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('mensaje_empresa')">
                                <span class="flex-1 font-medium">🏢 {{ i18n.t('hist.expEmpresa') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'mensaje_empresa' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_empresa!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'mensaje_empresa') { <div style="border-top: 1px solid var(--border);"><pre class="text-[11px] whitespace-pre-wrap font-sans leading-relaxed px-2 py-1.5" style="margin: 0;">{{ p.resultado_empresa }}</pre></div> }
                            </div>
                          }
                          @if (tipo === 'mensaje_recruiter' && p.resultado_recruiter) {
                            <div style="border: 1px solid var(--border); border-radius: 0.25rem; overflow: hidden;">
                              <div class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs" [style.background-color]="expandedMsg() === 'mensaje_recruiter' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg('mensaje_recruiter')">
                                <span class="flex-1 font-medium">👤 {{ i18n.t('hist.expRecruiter') }}</span>
                                <span style="opacity: 0.4;">{{ expandedMsg() === 'mensaje_recruiter' ? '▲' : '▼' }}</span>
                                <button class="btn btn-ghost btn-sm text-xs" (click)="copyMsg(p.resultado_recruiter!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                              </div>
                              @if (expandedMsg() === 'mensaje_recruiter') { <div style="border-top: 1px solid var(--border);"><pre class="text-[11px] whitespace-pre-wrap font-sans leading-relaxed px-2 py-1.5" style="margin: 0;">{{ p.resultado_recruiter }}</pre></div> }
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }
                @if (col.items.length === 0) {
                  <div class="kanban-empty">{{ i18n.t('hist.vacio') }}</div>
                }
              </div>
            </div>
          }
        </div>
      </div>
      }
    }

    <!-- EDIT EMPRESA MODAL -->
    @if (empresaLinkModal()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" style="background: rgba(0,0,0,0.3);">
        <div class="card w-full max-w-md mx-4 animate-fade-in" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ i18n.t('hist.editEmpresaTitle') }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.empresaNombre') }}</label>
              <input [(ngModel)]="empresaLinkModal()!.nombre" class="text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('np.empresaLink') }}</label>
              <input [(ngModel)]="empresaLinkModal()!.link" class="text-sm" [placeholder]="i18n.t('np.empresaLinkPh')" />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="btn btn-outline" (click)="closeEmpresaLinkModal()">{{ i18n.t('common.cancel') }}</button>
            <button class="btn btn-primary" (click)="saveEmpresaLink()">{{ i18n.t('common.save') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- EDIT MODAL -->
    @if (editModal()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" style="background: rgba(0,0,0,0.3);">
        <div class="card w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold mb-4">{{ i18n.t('hist.editTitle') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.empresa') }}</label>
              <select [(ngModel)]="editForm.empresa" class="text-sm" (ngModelChange)="onEditEmpresaChange($event)">
                @for (e of editEmpresaOptions; track e) { <option [value]="e">{{ e }}</option> }
              </select>
            </div>
            @if (editUsed().has('oferta_laboral')) {
              <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.oferta') }}</label><input [(ngModel)]="editForm.oferta_laboral" class="text-sm" /></div>
            }
            @if (editUsed().has('nombre_empleado')) {
              <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.reclutador') }}</label><input [(ngModel)]="editForm.nombre_empleado" class="text-sm" /></div>
            }
            @if (editUsed().has('puesto_empleado')) {
              <div><label class="text-xs font-medium block mb-1" style="opacity: 0.5;">{{ i18n.t('hist.field.puestoRecl') }}</label><input [(ngModel)]="editForm.puesto_empleado" class="text-sm" /></div>
            }
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
  viewMode = signal<'tabla' | 'kanban' | 'empresa'>(localStorage.getItem('postulatool.hist.view') === 'kanban' ? 'tabla' : localStorage.getItem('postulatool.hist.view') === 'empresa' ? 'empresa' : 'tabla');
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
  empresasByName = computed(() => new Map(this.empresas().map(e => [e.nombre, e])));
  empresaSortDir = signal<'asc' | 'desc'>('asc');
  openEmpresas = signal<Set<string>>(new Set());
  openEmpresaMensajes = signal<Set<string>>(new Set());
  empresaLinkModal = signal<{ id: number; nombre: string; link: string; linkOriginal: string } | null>(null);

  grupos = computed<EmpresaGrupo[]>(() => {
    const groups = groupByEmpresa(this.filteredSorted());
    const dir = this.empresaSortDir();
    groups.sort((a, b) => {
      const cmp = a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase());
      return dir === 'asc' ? cmp : -cmp;
    });
    return groups;
  });

  toggleEmpresaSort() { this.empresaSortDir.update(d => d === 'asc' ? 'desc' : 'asc'); }

  toggleEmpresa(nombre: string) {
    this.openEmpresas.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }

  toggleEmpresaMensaje(nombre: string) {
    this.openEmpresaMensajes.update(s => { const n = new Set(s); if (n.has(nombre)) n.delete(nombre); else n.add(nombre); return n; });
  }

  findEmpresa(nombre: string): Empresa | undefined {
    return this.empresasByName().get(nombre);
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
    if (e) this.empresaLinkModal.set({ id: e.id, nombre: e.nombre, link: e.link, linkOriginal: e.link });
  }

  closeEmpresaLinkModal() { this.empresaLinkModal.set(null); }

  async saveEmpresaLink() {
    const m = this.empresaLinkModal();
    if (!m) return;
    const original = this.empresas().find(e => e.id === m.id)?.nombre;
    const linkNuevo = (m.link || '').trim();
    const linkOriginal = m.linkOriginal || '';

    if (linkNuevo !== linkOriginal) {
      const n = this.postulaciones().filter(p => p.empresa === m.nombre || p.empresa === original).length;
      const ok = await this.dialog.confirm(this.i18n.t('hist.linkChangeConfirm', {
        empresa: m.nombre,
        count: n,
        from: linkOriginal || '—',
        to: linkNuevo || '—',
      }));
      if (!ok) {
        this.empresaLinkModal.set({ ...m, link: linkOriginal });
        return;
      }
    }

    this.api.updateEmpresa(m.id, { nombre: m.nombre, link: linkNuevo }).subscribe({
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
        if (err?.error?.error === 'EMPRESA_EXISTE') this.dialog.toast(this.i18n.t('np.empresaExiste'));
        else this.dialog.toast(this.i18n.t('common.error.save'));
      },
    });
  }

  async deleteEmpresaGroup(g: EmpresaGrupo) {
    const count = g.items.length;
    const ok = await this.dialog.confirm(this.i18n.t('hist.delEmpresaConfirm', { empresa: g.nombre, count }));
    if (!ok) return;
    const e = this.findEmpresa(g.nombre);
    if (e) {
      this.api.deleteEmpresa(e.id).subscribe({
        next: () => {
          this.openEmpresas.update(s => { const n = new Set(s); n.delete(g.nombre); return n; });
          this.shared.empresasRefresh.update(v => v + 1);
          this.load();
        },
        error: () => this.dialog.toast(this.i18n.t('common.error.save')),
      });
    } else {
      for (const p of g.items) {
        await new Promise<void>(r => this.api.deletePostulacion(p.id).subscribe({ next: () => r(), error: () => r() }));
      }
      this.load();
    }
  }

  loadEmpresas(onDone?: () => void) {
    this.api.getEmpresas().subscribe(d => {
      this.empresas.set(d);
      onDone?.();
    });
  }

  catNombres: Record<number, string> = {};
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
    effect(() => { void shared.empresasRefresh(); if (this.inited) this.loadEmpresas(); });
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

  ngOnInit() {}

  initData() {
    this.restoreFilters();
    this.loading.set(true);
    let done = 0;
    const checkDone = () => { if (++done >= 5) this.loading.set(false); };
    this.loadCategorias(checkDone);
    this.loadTags(checkDone);
    this.loadIdiomas(checkDone);
    this.loadEmpresas(checkDone);
    this.api.getPostulaciones().subscribe(d => { this.postulaciones.set(d); checkDone(); });
    this.inited = true;
  }

  load() { this.loading.set(true); this.api.getPostulaciones({ trashed: this.trashMode() }).subscribe(d => { this.postulaciones.set(d); this.loading.set(false); }); }

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
    this.expandedId.set(null);
    this.expandedMsg.set(null);
    this.loading.set(true);
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

  setView(v: 'tabla' | 'kanban' | 'empresa') {
    this.viewMode.set(v);
    localStorage.setItem('postulatool.hist.view', v);
  }

  kanbanColumns = computed(() => {
    const known = this.estados.map(e => e.value).filter(v => v !== this.OTRAS);
    const list = this.filteredSorted();
    return this.estados
      .filter(e => this.checkedEstados().has(e.value))
      .map(e => ({
        value: e.value,
        label: e.label,
        color: e.color,
        items: list.filter(p => e.value === this.OTRAS ? !known.includes(p.estado) : p.estado === e.value),
      }));
  });

  onKanbanDrop(event: CdkDragDrop<any[]>, targetEstado: string) {
    if (targetEstado === this.OTRAS) return;
    const p = event.item.data as Postulacion;
    if (!p || p.estado === targetEstado) return;
    this.api.updatePostulacion(p.id, { estado: targetEstado } as any).subscribe({
      next: () => this.postulaciones.update(list => list.map(x => x.id === p.id ? { ...x, estado: targetEstado as Postulacion['estado'] } : x)),
      error: () => this.load(),
    });
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

  onTableSort(field: string) { this.toggleSort(field as SortField); }

  isSelectedFn = (id: number) => this.selectedIds().has(id);

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
    return `${Math.min(i * 30, 300)}ms`;
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
      contacto_empleado: this.editForm.contacto_empleado,
    };
    if (this.editUsed().has('oferta_laboral')) payload.oferta_laboral = this.editForm.oferta_laboral;
    if (this.editUsed().has('nombre_empleado')) payload.nombre_empleado = this.editForm.nombre_empleado;
    if (this.editUsed().has('puesto_empleado')) payload.puesto_empleado = this.editForm.puesto_empleado;
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
      if (e) await new Promise<void>(r => this.api.updateEmpresa(e.id, { link: linkNuevo }).subscribe({ next: () => r(), error: () => r() }));
      this.shared.empresasRefresh.update(v => v + 1);
    }

    this.api.updatePostulacion(this.editId, payload).subscribe({
      next: () => {
        this.closeEditModal();
        this.load();
      },
      error: () => this.dialog.toast(this.i18n.t('common.error.save')),
    });
  }
}
