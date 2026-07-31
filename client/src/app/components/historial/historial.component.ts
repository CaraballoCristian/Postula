import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ClipboardService } from '../../services/clipboard.service';
import { Postulacion, TIPO_LABELS, TIPO_ICONS } from '../../models/interfaces';

type SortField = 'fecha' | 'empresa' | 'puesto_oferta' | 'nombre_reclutador';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <input
        [(ngModel)]="filtroEmpresa"
        (input)="load()"
        placeholder="Filtrar por empresa..."
        class="text-sm w-48"
      />
      <span class="text-sm" style="opacity: 0.5;">{{ postulaciones().length }} postulaciones</span>
    </div>

    @if (postulaciones().length === 0) {
      <div class="card text-center py-8" style="opacity: 0.5;">
        No hay postulaciones todavía. Generá una desde "Nueva Postulación".
      </div>
    } @else {
      <div class="card overflow-x-auto" style="padding: 0;">
        <table class="w-full text-sm">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              @for (col of columns; track col.field) {
                <th
                  class="text-left px-3 py-2 font-medium cursor-pointer select-none hover:opacity-80"
                  (click)="toggleSort(col.field)"
                >
                  <span class="inline-flex items-center gap-1">
                    {{ col.label }}
                    @if (sortField() === col.field) {
                      <span>{{ sortDir() === 'asc' ? '▲' : '▼' }}</span>
                    }
                  </span>
                </th>
              }
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            @for (p of sortedPostulaciones(); track p.id) {
              <tr
                class="cursor-pointer"
                style="border-bottom: 1px solid var(--border);"
                [style.background-color]="expandedId() === p.id ? 'var(--surface-hover)' : 'transparent'"
              >
                <td class="px-3 py-2 text-xs" style="opacity: 0.6;">{{ formatFecha(p.fecha) }}</td>
                <td class="px-3 py-2 font-medium">{{ p.empresa }}</td>
                <td class="px-3 py-2">{{ p.puesto_oferta }}</td>
                <td class="px-3 py-2">
                  @if (p.categoria_id) {
                    <span class="badge" style="background: var(--accent); color: #fff; font-size: 0.65rem;">
                      {{ getCategoriaNombre(p.categoria_id) }}
                    </span>
                  }
                </td>
                <td class="px-3 py-2">{{ p.nombre_reclutador }}</td>
                <td class="px-3 py-1 text-right">
                  <div class="flex gap-1 justify-end">
                    <button class="btn btn-ghost btn-sm" (click)="toggleExpand(p.id)">Ver</button>
                    <button class="btn btn-ghost btn-sm text-red-400" (click)="deletePost(p.id)">×</button>
                  </div>
                </td>
              </tr>
              @if (expandedId() === p.id) {
                <tr>
                  <td colspan="6" class="px-3 py-3">
                    <div class="space-y-3">
                      @if (p.resultado_email) {
                        <div class="card">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium">✉ Email</span>
                            <button class="btn btn-outline btn-sm" (click)="clipboard.copy(p.resultado_email!)">📋 Copiar</button>
                          </div>
                          <pre class="text-xs whitespace-pre-wrap font-sans" style="line-height: 1.6;">{{ p.resultado_email }}</pre>
                        </div>
                      }
                      @if (p.resultado_empresa) {
                        <div class="card">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium">🏢 Mensaje Empresa</span>
                            <button class="btn btn-outline btn-sm" (click)="clipboard.copy(p.resultado_empresa!)">📋 Copiar</button>
                          </div>
                          <pre class="text-xs whitespace-pre-wrap font-sans" style="line-height: 1.6;">{{ p.resultado_empresa }}</pre>
                        </div>
                      }
                      @if (p.resultado_recruiter) {
                        <div class="card">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium">👤 Mensaje Recruiter</span>
                            <button class="btn btn-outline btn-sm" (click)="clipboard.copy(p.resultado_recruiter!)">📋 Copiar</button>
                          </div>
                          <pre class="text-xs whitespace-pre-wrap font-sans" style="line-height: 1.6;">{{ p.resultado_recruiter }}</pre>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class HistorialComponent implements OnInit {
  postulaciones = signal<Postulacion[]>([]);
  filtroEmpresa = '';
  sortField = signal<SortField>('fecha');
  sortDir = signal<'asc' | 'desc'>('desc');
  expandedId = signal<number | null>(null);

  columns: { field: SortField; label: string }[] = [
    { field: 'fecha', label: 'Fecha' },
    { field: 'empresa', label: 'Empresa' },
    { field: 'puesto_oferta', label: 'Puesto' },
    { field: 'fecha' as SortField, label: 'Categoría' },
    { field: 'nombre_reclutador', label: 'Reclutador' },
  ];

  private categoriaNombres: Record<number, string> = {};

  constructor(
    private api: ApiService,
    public clipboard: ClipboardService,
  ) {}

  ngOnInit() {
    this.api.getCategorias().subscribe(data => {
      for (const c of data) {
        this.categoriaNombres[c.id] = c.nombre;
      }
    });
    this.load();
  }

  load() {
    const filters: any = {};
    if (this.filtroEmpresa.trim()) {
      filters.empresa = this.filtroEmpresa.trim();
    }
    this.api.getPostulaciones(filters).subscribe(data => {
      this.postulaciones.set(data);
    });
  }

  getCategoriaNombre(id: number): string {
    return this.categoriaNombres[id] || '';
  }

  toggleSort(field: SortField) {
    if (field === 'fecha' && this.sortField() === 'fecha') {
      // skip the categoria dummy column
    }
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  sortedPostulaciones(): Postulacion[] {
    const list = [...this.postulaciones()];
    const field = this.sortField();
    const dir = this.sortDir();

    list.sort((a, b) => {
      let av: any = a[field] ?? '';
      let bv: any = b[field] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }

  formatFecha(fecha: string): string {
    return fecha.replace('T', ' ').substring(0, 16);
  }

  toggleExpand(id: number) {
    this.expandedId.update(v => v === id ? null : id);
  }

  deletePost(id: number) {
    if (!confirm('¿Eliminar esta postulación del historial?')) return;
    this.api.deletePostulacion(id).subscribe(() => {
      this.expandedId.set(null);
      this.load();
    });
  }
}
