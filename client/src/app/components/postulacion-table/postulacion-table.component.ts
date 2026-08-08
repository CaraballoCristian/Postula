import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Postulacion, EstadoOption } from '../../models/interfaces';
import { I18nService } from '../../services/i18n.service';

interface TableCol {
  field: string;
  labelKey: any;
}

@Component({
  selector: 'app-postulacion-table',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card" style="padding: 0;">
      <div class="overflow-x-auto" style="overflow-y: hidden;">
        <table class="w-full text-xs">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              @if (selectionMode) { <th class="px-3 py-2.5 w-8"></th> }
              @for (col of columns; track col.field) {
                <th class="text-left px-3 py-2.5 font-medium cursor-pointer select-none text-xs" style="opacity: 0.5; border-left: 1px solid var(--border);" (click)="toggleSort.emit(col.field)">
                  <span class="inline-flex items-center gap-1">{{ i18n.t(col.labelKey) }} @if (sortField === col.field) { <span class="text-[10px]">{{ sortDir === 'asc' ? '▲' : '▼' }}</span> }</span>
                </th>
              }
              <th class="px-3 py-2.5" style="border-left: 1px solid var(--border);"></th>
            </tr>
          </thead>
          <tbody>
            @for (p of rows; track p.id; let i = $index) {
              <tr class="cursor-pointer transition-colors animate-stagger-row" [style.animation-delay]="stagger(i)" style="border-bottom: 1px solid var(--border);" [style.background-color]="expandedId === p.id ? 'var(--surface-hover)' : (hoverRow === p.id ? 'var(--surface-hover)' : 'transparent')" (mouseenter)="hoverRow = p.id" (mouseleave)="hoverRow = null">
                @if (selectionMode) {
                  <td class="px-3 py-2.5" (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="isSelected(p.id)" (change)="toggleSelect.emit(p.id)" class="w-3.5 h-3.5" style="accent-color: var(--accent);" />
                  </td>
                }
                @if (show('favorito')) {
                  <td class="px-3 py-2.5 text-center" (click)="toggleFav.emit(p); $event.stopPropagation()" [title]="i18n.t('hist.titFavorito')">
                    <span class="cursor-pointer select-none">{{ p.favorito ? '⭐' : '☆' }}</span>
                  </td>
                }
                @if (show('fecha')) {
                  <td class="px-3 py-2.5 text-xs" style="opacity: 0.45; white-space: nowrap; border-left: 1px solid var(--border);">{{ formatFecha(p.fecha) }}</td>
                }
                @if (show('empresa')) {
                  <td class="px-3 py-2.5 font-medium" style="white-space: nowrap; border-left: 1px solid var(--border);">
                    <span style="display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.empresa }}</span>
                    @if (p.link_empresa) {
                      <a [href]="fixUrl(p.link_empresa)" target="_blank" rel="noopener" class="ml-1 no-underline" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                    }
                  </td>
                }
                @if (show('categoria_id')) {
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">
                    @if (p.categoria_id) { <span class="badge text-[0.65rem]" style="background: var(--accent); color: var(--accent-contrast, #fff);">{{ catNombre(p.categoria_id) }}</span> }
                  </td>
                }
                @if (show('idioma')) {
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">{{ p.idioma || '—' }}</td>
                }
                @if (show('oferta_laboral')) {
                  <td class="px-3 py-2.5" style="max-width: 90px; white-space: nowrap; border-left: 1px solid var(--border);"><span style="display: inline-block; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.oferta_laboral || '—' }}</span></td>
                }
                @if (show('nombre_empleado')) {
                  <td class="px-3 py-2.5" style="white-space: nowrap; border-left: 1px solid var(--border);">
                    <span style="display: inline-block; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.nombre_empleado || '—' }}</span>
                    @if (p.contacto_empleado) {
                      <a [href]="fixUrl(p.contacto_empleado)" target="_blank" rel="noopener" class="ml-1 no-underline" style="color: var(--accent);" [title]="i18n.t('hist.abrirLink')">↗</a>
                    }
                  </td>
                }
                @if (show('puesto_empleado')) {
                  <td class="px-3 py-2.5" style="white-space: nowrap; border-left: 1px solid var(--border);"><span style="display: inline-block; max-width: 75px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom;">{{ p.puesto_empleado || '—' }}</span></td>
                }
                @if (show('estado')) {
                  <td class="px-3 py-2.5" style="border-left: 1px solid var(--border);">
                    <span class="badge text-[0.65rem]" [style.background-color]="estadoColor(p.estado)" [style.color]="p.estado === 'solicitado' ? '' : '#fff'">{{ estadoLabel(p.estado) }}</span>
                  </td>
                }
                <td class="px-3 py-2.5 text-right" style="border-left: 1px solid var(--border);">
                  <div class="flex gap-1 justify-end">
                    @if (trashMode) {
                      <button class="btn btn-ghost btn-sm" (click)="restore.emit(p.id)" [title]="i18n.t('pap.restore')">↩️</button>
                      <button class="btn btn-ghost btn-sm" (click)="deleteForGood.emit(p.id)" [title]="i18n.t('pap.delHard')">🗑️</button>
                    } @else {
                      <button class="btn btn-ghost btn-sm" (click)="view.emit(p.id)" [title]="i18n.t('hist.verMensajes')">👁</button>
                      <button class="btn btn-ghost btn-sm" (click)="edit.emit(p)" [title]="i18n.t('common.edit')">✏️</button>
                      <button class="btn btn-ghost btn-sm" (click)="delete.emit(p.id)" [title]="i18n.t('common.delete')">🗑️</button>
                    }
                  </div>
                </td>
              </tr>
              @if (expandedId === p.id) {
                <tr>
                  <td [attr.colspan]="colspan" class="px-4 py-3">
                    <div class="space-y-2">
                      @if (!hideEmpresaLink && p.link_empresa) {
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
                            <div class="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs" [style.background-color]="expandedMsg === 'email' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg.emit('email')">
                              <span class="flex-1 font-medium">✉ {{ i18n.t('hist.expEmail') }}</span>
                              <span style="opacity: 0.4;">{{ expandedMsg === 'email' ? '▲' : '▼' }}</span>
                              <button class="btn btn-ghost btn-sm text-xs" (click)="copy.emit(p.resultado_email!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                            </div>
                            @if (expandedMsg === 'email') {
                              <div style="border-top: 1px solid var(--border);"><pre class="text-xs whitespace-pre-wrap font-sans leading-relaxed px-3 py-2" style="margin: 0;">{{ p.resultado_email }}</pre></div>
                            }
                          </div>
                        }
                        @if (tipo === 'mensaje_recruiter' && p.resultado_recruiter) {
                          <div class="animate-fade-in" style="border: 1px solid var(--border); border-radius: 0.375rem; overflow: hidden;">
                            <div class="flex items-center gap-3 px-3 py-2 cursor-pointer text-xs" [style.background-color]="expandedMsg === 'mensaje_recruiter' ? 'var(--surface-hover)' : 'transparent'" (click)="toggleMsg.emit('mensaje_recruiter')">
                              <span class="flex-1 font-medium">👤 {{ i18n.t('hist.expRecruiter') }}</span>
                              <span style="opacity: 0.4;">{{ expandedMsg === 'mensaje_recruiter' ? '▲' : '▼' }}</span>
                              <button class="btn btn-ghost btn-sm text-xs" (click)="copy.emit(p.resultado_recruiter!); $event.stopPropagation()" [title]="i18n.t('hist.copy')">📋</button>
                            </div>
                            @if (expandedMsg === 'mensaje_recruiter') {
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
  `,
})
export class PostulacionTableComponent {
  @Input() rows: Postulacion[] = [];
  @Input() columns: TableCol[] = [];
  @Input() selectionMode = false;
  @Input() trashMode = false;
  @Input() sortField = '';
  @Input() sortDir: 'asc' | 'desc' = 'desc';
  @Input() expandedId: number | null = null;
  @Input() expandedMsg: string | null = null;
  @Input() estados: EstadoOption[] = [];
  @Input() catNombres: Record<number, string> = {};
  @Input() isSelected: (id: number) => boolean = () => false;
  @Input() hideEmpresaLink = false;

  @Output() toggleFav = new EventEmitter<Postulacion>();
  @Output() toggleSelect = new EventEmitter<number>();
  @Output() toggleSort = new EventEmitter<string>();
  @Output() view = new EventEmitter<number>();
  @Output() edit = new EventEmitter<Postulacion>();
  @Output() delete = new EventEmitter<number>();
  @Output() restore = new EventEmitter<number>();
  @Output() deleteForGood = new EventEmitter<number>();
  @Output() toggleMsg = new EventEmitter<string>();
  @Output() copy = new EventEmitter<string>();

  msgTipos = ['email', 'mensaje_empresa', 'mensaje_recruiter'];
  hoverRow: number | null = null;

  constructor(public i18n: I18nService) {}

  get colspan(): number {
    return (this.selectionMode ? 1 : 0) + this.columns.length + 1;
  }

  show(field: string): boolean {
    return this.columns.some(c => c.field === field);
  }

  catNombre(id: number) {
    return this.catNombres[id] ? this.i18n.categoriaLabel(this.catNombres[id]) : '';
  }

  estadoLabel(v: string) { return this.estados.find(e => e.value === v)?.label || v; }
  estadoColor(v: string) { return this.estados.find(e => e.value === v)?.color || 'var(--surface-hover)'; }

  formatFecha(f: string) {
    const d = f.substring(0, 10);
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y.substring(2)}`;
  }

  fixUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return 'https://' + url;
  }

  stagger(i: number): string {
    return `${Math.min(i * 30, 300)}ms`;
  }
}
