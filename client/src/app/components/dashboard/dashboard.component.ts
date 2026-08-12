import { Component, OnInit, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SharedStateService } from '../../services/shared-state.service';
import { I18nService } from '../../services/i18n.service';
import { Postulacion, Categoria, Idioma, Tag } from '../../models/interfaces';
import { OTRAS } from '../../models/constants';
import { dayKey } from '../../utils/utils';

interface EstadoGroup {
  value: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

interface BarItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

type Quick = 'today' | 'week' | 'month' | 'all';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
  styles: [`
    :host { display: block; }
    .pie-wrap {
      position: relative;
      width: 120px;
      height: 120px;
    }
    .pie {
      width: 100%;
      height: 100%;
      transform: rotate(0deg);
    }
    .pie circle {
      transition: stroke-dashoffset 0.5s ease;
    }
    .pie-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.1rem;
      pointer-events: none;
    }
  `],
})
export class DashboardComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  loading = signal(true);
  all = signal<Postulacion[]>([]);
  tags = signal<Tag[]>([]);
  categoriasList = signal<Categoria[]>([]);
  idiomasList = signal<Idioma[]>([]);

  quick = signal<Quick>('all');
  from = signal<Date | null>(null);
  to = signal<Date | null>(null);
  quickOpts: Quick[] = ['today', 'week', 'month', 'all'];
  readonly OTRAS = OTRAS;

  quickLabel(q: Quick): string {
    return this.i18n.t(`dash.${q}` as any);
  }

  private inited = false;
  private lastRefresh = 0;
  private activeBefore = '';

  constructor(
    private api: ApiService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    effect(() => {
      const refresh = shared.historialRefresh();
      const tab = shared.activeTab();
      if (!this.inited) return;
      const entering = tab === 'dashboard' && tab !== this.activeBefore;
      this.activeBefore = tab;
      if (entering || refresh !== this.lastRefresh) {
        this.lastRefresh = refresh;
        this.load();
      }
    });
  }

  ngOnInit() {
    this.inited = true;
    this.lastRefresh = this.shared.historialRefresh();
    this.load();
  }

  load() {
    this.loading.set(true);
    let done = 0;
    const check = () => { if (++done >= 4) this.loading.set(false); };
    this.api.getPostulaciones({ trashed: false }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.all.set(d); check(); });
    this.api.getTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.tags.set(d); check(); });
    this.api.getCategorias().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.categoriasList.set(d); check(); });
    this.api.getIdiomas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(d => { this.idiomasList.set(d); check(); });
  }

  // ── Rango ──
  setQuick(q: Quick) {
    this.quick.set(q);
    this.from.set(this.quickFrom(q));
    this.to.set(this.quickTo(q));
  }
  private quickFrom(q: Quick): Date | null {
    const now = startOfDay(new Date());
    if (q === 'today') return now;
    if (q === 'week') return startOfDay(new Date(now.getTime() - 6 * 86400000));
    if (q === 'month') return startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    return null;
  }
  private quickTo(q: Quick): Date | null {
    if (q === 'all') return null;
    return startOfDay(new Date());
  }
  setFrom(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.quick.set('all');
    this.from.set(v ? startOfDay(new Date(v + 'T00:00:00')) : null);
  }
  setTo(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.quick.set('all');
    this.to.set(v ? startOfDay(new Date(v + 'T00:00:00')) : null);
  }
  clearRange() { this.quick.set('all'); this.from.set(null); this.to.set(null); }
  fromStr() { return this.from() ? dayKey(this.from()!) : ''; }
  toStr() { return this.to() ? dayKey(this.to()!) : ''; }

  private inRange(p: Postulacion): boolean {
    const d = startOfDay(new Date(p.created_at));
    if (this.from() && d < this.from()!) return false;
    if (this.to()) {
      const to = startOfDay(new Date(this.to()!.getTime() + 86400000));
      if (d >= to) return false;
    }
    return true;
  }

  filtered = computed(() => this.all().filter(p => this.inRange(p)));

  // ── KPIs ──
  totalAll = computed(() => this.all().length);
  totalMonth = computed(() => {
    const now = new Date();
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    return this.all().filter(p => startOfDay(new Date(p.created_at)) >= start).length;
  });
  // Comparación del período actual vs el anterior, según el filtro rápido
  comp = computed(() => {
    const now = startOfDay(new Date());
    const day = 86400000;
    const q = this.quick();
    let cur = 0;
    let prev = 0;
    let type: 'day' | 'week' | 'month' = 'week';
    if (q === 'today') {
      type = 'day';
      const y = new Date(now.getTime() - day);
      cur = this.countRange(now, now);
      prev = this.countRange(y, y);
    } else if (q === 'month') {
      type = 'month';
      const curStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const prevStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      cur = this.countRange(curStart, now);
      prev = this.countRange(prevStart, new Date(curStart.getTime() - day));
    } else {
      type = 'week';
      // Semana calendario anclada al lunes (misma lógica que el gráfico de tendencia).
      const anchor = new Date(now.getTime() - ((now.getDay() + 6) % 7) * day); // lunes de esta semana
      const prevAnchor = new Date(anchor.getTime() - 7 * day); // lunes de la semana anterior
      cur = this.countRange(anchor, now);
      prev = this.countRange(prevAnchor, new Date(anchor.getTime() - day));
    }
    const delta = prev === 0 ? (cur === 0 ? 0 : 100) : Math.round(((cur - prev) / prev) * 100);
    return { delta, cur, prev, type };
  });
  private countRange(from: Date, to: Date): number {
    const f = startOfDay(from);
    const t = startOfDay(to);
    return this.all().filter(p => {
      const d = startOfDay(new Date(p.created_at));
      return d >= f && d <= t;
    }).length;
  }
  compTitle() {
    return this.comp().type === 'day' ? 'dash.vsAyer' : this.comp().type === 'month' ? 'dash.vsMes' : 'dash.weekComp';
  }
  compHint() {
    return this.comp().type === 'day' ? 'dash.vsAyerHint' : this.comp().type === 'month' ? 'dash.vsMesHint' : 'dash.weekCompHint';
  }
  // Racha: días consecutivos con ≥1 postulación. Sigue viva todo el día si el
  // último día con actividad es hoy o ayer; si es más viejo, ya se rompió.
  streak = computed(() => {
    if (this.totalAll() === 0) return 0;
    const days = new Set<string>();
    let last: Date | null = null;
    for (const p of this.all()) {
      const d = startOfDay(new Date(p.created_at));
      days.add(dayKey(d));
      if (!last || d > last) last = d;
    }
    if (!last) return 0;
    const today = startOfDay(new Date());
    // Si el último día con actividad es anterior a ayer, la racha ya se perdió.
    if (last.getTime() < today.getTime() - 86400000) return 0;
    let cursor = last;
    let streakCount = 0;
    while (days.has(dayKey(cursor))) {
      streakCount++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streakCount;
  });

  // ── Tendencia (la resolución sigue el filtro) ──
  granularity = computed<'day' | 'week' | 'month'>(() => {
    const q = this.quick();
    if (q === 'month') return 'month';
    if (q === 'week') return 'week';
    return 'day'; // 'today' y 'all' → día
  });
  trendTitle() {
    return this.granularity() === 'day' ? 'dash.tendenciaDia' : this.granularity() === 'month' ? 'dash.tendenciaMes' : 'dash.tendencia';
  }
  trend = computed(() => {
    const now = startOfDay(new Date());
    const g = this.granularity();
    const day = 86400000;
    const buckets: ({ start: Date; count: number })[] = [];
    const step = g === 'day' ? day : 7 * day;
    if (g === 'day') {
      const first = new Date(now.getTime() - 6 * day);
      for (let i = 0; i <= 6; i++) buckets.push({ start: new Date(first.getTime() + i * day), count: 0 });
    } else if (g === 'month') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ start: startOfDay(d), count: 0 });
      }
    } else {
      const anchor = new Date(now.getTime() - ((now.getDay() + 6) % 7) * day); // lunes
      for (let i = 7; i >= 0; i--) buckets.push({ start: startOfDay(new Date(anchor.getTime() - i * 7 * day)), count: 0 });
    }
    for (const p of this.all()) {
      const d = startOfDay(new Date(p.created_at));
      for (const b of buckets) {
        if (g === 'month') {
          if (d.getFullYear() === b.start.getFullYear() && d.getMonth() === b.start.getMonth()) { b.count++; break; }
        } else if (d >= b.start && d < new Date(b.start.getTime() + step)) { b.count++; break; }
      }
    }
    return buckets.map(b => {
      let label: string;
      if (g === 'month') {
        label = `${b.start.getMonth() + 1}/${String(b.start.getFullYear()).slice(-2)}`;
      } else {
        label = `${String(b.start.getDate()).padStart(2, '0')}/${String(b.start.getMonth() + 1).padStart(2, '0')}`;
      }
      return { label, count: b.count };
    });
  });
  trendMax = computed(() => Math.max(1, ...this.trend().map(t => t.count)));

  // ── Estado ──
  private stateLabel(value: string) {
    if (!value || value === '__sin__') return this.i18n.t('dash.sinEstado');
    return this.i18n.tagLabel(value);
  }
  private stateColor(value: string) {
    if (!value || value === '__sin__') return 'var(--surface-hover)';
    return this.tags().find(t => t.nombre === value)?.color || 'var(--surface-hover)';
  }
  estados = computed<EstadoGroup[]>(() => {
    // Solo cuentan las tags reales de la cuenta; estados huérfanos (importados con la tag
    // renombrada/inexistente) y __otras__ colapsan a una sola porción "Sin etiqueta".
    const known = new Set(this.tags().map(t => t.nombre));
    const map = new Map<string, number>();
    for (const p of this.all()) {
      const key = p.estado && known.has(p.estado) ? p.estado : (p.estado ? this.OTRAS : '__sin__');
      map.set(key, (map.get(key) || 0) + 1);
    }
    const total = this.all().length || 1;
    return [...map.entries()].map(([value, count]) => ({
      value,
      label: value === this.OTRAS ? this.i18n.t('hist.sinEtiqueta') : this.stateLabel(value),
      color: value === this.OTRAS ? '#eee' : this.stateColor(value),
      count,
      pct: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count);
  });
  // Donut SVG: cada segmento = dash y offset del círculo (circunferencia C = 2π·50 ≈ 314.16)
  pie = computed(() => {
    const CIRC = 2 * Math.PI * 50;
    const groups = this.estados();
    const total = groups.reduce((s, e) => s + e.count, 0) || 1;
    let acc = 0;
    return groups.map(e => {
      const frac = e.count / total;
      const segLen = frac * CIRC;
      const seg = { color: e.color, dash: `${segLen - 1.5} ${CIRC - segLen + 1.5}`, offset: -acc };
      acc += segLen;
      return seg;
    });
  });

  // ── Categoría / Idioma ──
  private barBuilder(items: { key: string | number; count: number }[]): BarItem[] {
    const total = items.reduce((s, i) => s + i.count, 0) || 1;
    const palette = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2'];
    return items.map((it, idx) => ({
      label: String(it.key),
      count: it.count,
      pct: Math.round((it.count / total) * 100),
      color: palette[idx % palette.length],
    })).sort((a, b) => b.count - a.count);
  }
  categorias = computed<BarItem[]>(() => {
    const catName = new Map<number, string>();
    for (const c of this.categoriasList()) catName.set(c.id, c.nombre);
    const map = new Map<string, number>();
    for (const p of this.filtered()) {
      if (p.categoria_id == null) { map.set(this.i18n.t('dash.sinCategoria'), (map.get(this.i18n.t('dash.sinCategoria')) || 0) + 1); continue; }
      const name = catName.get(p.categoria_id);
      const label = name ? this.i18n.categoriaLabel(name) : `${p.categoria_id}`;
      map.set(label, (map.get(label) || 0) + 1);
    }
    return this.barBuilder([...map.entries()].map(([k, v]) => ({ key: k, count: v })));
  });
  idiomas = computed<BarItem[]>(() => {
    const map = new Map<string, number>();
    for (const p of this.filtered()) {
      const k = p.idioma || this.i18n.t('dash.sinIdioma');
      map.set(k, (map.get(k) || 0) + 1);
    }
    return this.barBuilder([...map.entries()].map(([k, v]) => ({ key: k, count: v })));
  });
}