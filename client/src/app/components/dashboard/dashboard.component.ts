import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { SharedStateService } from '../../services/shared-state.service';
import { I18nService } from '../../services/i18n.service';
import { Postulacion, Categoria, Idioma, Tag } from '../../models/interfaces';

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

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  template: `
    <div class="space-y-4">
      @if (loading()) {
        <div class="card text-center py-10 flex items-center justify-center gap-2" style="opacity: 0.5;">
          <span class="loader"></span> {{ i18n.t('common.loading') }}
        </div>
      } @else {
        <!-- FILTROS -->
        <div class="card flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div class="flex gap-1 flex-wrap">
            @for (q of quickOpts; track q) {
              <button class="view-pill" [class.active]="quick() === q" (click)="setQuick(q)">{{ quickLabel(q) }}</button>
            }
          </div>
          <div class="flex items-center gap-2 flex-1 justify-end flex-wrap">
            <label class="text-xs flex items-center gap-1" style="opacity: 0.7;">
              {{ i18n.t('dash.desde') }}
              <input type="date" [value]="fromStr()" (change)="setFrom($event)" class="w-auto" style="font-size: 0.8rem; padding: 0.3rem 0.5rem;" />
            </label>
            <label class="text-xs flex items-center gap-1" style="opacity: 0.7;">
              {{ i18n.t('dash.hasta') }}
              <input type="date" [value]="toStr()" (change)="setTo($event)" class="w-auto" style="font-size: 0.8rem; padding: 0.3rem 0.5rem;" />
            </label>
            @if (from() || to()) {
              <button class="btn btn-ghost btn-sm" (click)="clearRange()">✕</button>
            }
          </div>
        </div>

        <!-- ══ BENTO GRID ══ -->
        <div class="grid grid-cols-1 md:grid-cols-4 auto-rows-min gap-3">
            <!-- Racha hero -->
            <div class="card md:col-span-2 md:row-span-2 flex flex-col items-center justify-center gap-2 text-center"
                 style="background: linear-gradient(135deg, rgba(250,204,21,0.12), transparent); border-color: rgba(250,204,21,0.35);">
              <span class="text-xs uppercase tracking-widest" style="opacity: 0.6;">{{ i18n.t('dash.streak') }}</span>
              <span class="text-5xl sm:text-6xl font-bold leading-none">🔥 {{ streak() }}</span>
              <span class="text-sm" style="opacity: 0.6;">{{ i18n.t('dash.streakHint', { days: streak() }) }}</span>
            </div>
            <!-- Total -->
            <div class="card flex flex-col gap-1">
              <span class="text-xs" style="opacity: 0.55;">{{ i18n.t('dash.total') }}</span>
              <span class="text-2xl font-semibold">{{ filtered().length }}</span>
              <span class="text-xs" style="opacity: 0.45;">{{ i18n.t('dash.totalHint', { month: totalMonth(), all: totalAll() }) }}</span>
            </div>
            <!-- vs período anterior -->
            <div class="card flex flex-col gap-1">
              <span class="text-xs" style="opacity: 0.55;">{{ i18n.t(compTitle()) }}</span>
              <span class="text-2xl font-semibold" [style.color]="comp().delta >= 0 ? '#16a34a' : '#dc2626'">
                {{ comp().delta >= 0 ? '▲' : '▼' }} {{ comp().delta }}%
              </span>
              <span class="text-xs" style="opacity: 0.45;">{{ i18n.t(compHint(), { cur: comp().cur, prev: comp().prev }) }}</span>
            </div>
            <!-- Tendencia wide -->
            <div class="card md:col-span-2">
              <h3 class="text-sm font-semibold mb-3">{{ i18n.t(trendTitle()) }}</h3>
              @if (trend().length === 0) {
                <p class="text-sm py-4 text-center" style="opacity: 0.4;">{{ i18n.t('dash.empty') }}</p>
              } @else {
                <div class="flex items-end gap-1 sm:gap-2 h-28">
                  @for (t of trend(); track t.label) {
                    <div class="flex flex-col items-center flex-1 min-w-0 h-full">
                      <div class="flex flex-col items-center justify-end w-full gap-1 flex-1 min-h-0">
                        <span class="text-[10px] font-medium" style="opacity: 0.7;">{{ t.count || '' }}</span>
                        <div class="w-full rounded-t-md" [style.height]="(t.count / trendMax()) * 100 + '%'" style="min-height: 6px; background: var(--accent); opacity: 0.9;"></div>
                      </div>
                      <span class="text-[10px] truncate w-full text-center shrink-0" style="opacity: 0.5; height: 1rem; line-height: 1rem;">{{ t.label }}</span>
                    </div>
                  }
                </div>
              }
            </div>
            <!-- Estado donut wide -->
            <div class="card md:col-span-2">
              <h3 class="text-sm font-semibold mb-3">{{ i18n.t('dash.byEstado') }}</h3>
              @if (estados().length === 0) {
                <p class="text-sm py-4 text-center" style="opacity: 0.4;">{{ i18n.t('dash.empty') }}</p>
              } @else {
                <div class="flex flex-col sm:flex-row items-center gap-5">
                  <div class="pie-wrap shrink-0">
                    <svg viewBox="0 0 120 120" class="pie">
                      @for (seg of pie(); track seg.color) {
                        <circle r="50" cx="60" cy="60" fill="none" [attr.stroke]="seg.color" stroke-width="14"
                          [attr.stroke-dasharray]="seg.dash" [attr.stroke-dashoffset]="seg.offset" transform="rotate(-90 60 60)" />
                      }
                    </svg>
                    <div class="pie-center">
                      <span class="text-xl font-semibold leading-none">{{ all().length }}</span>
                      <span class="text-[10px]" style="opacity: 0.5;">{{ i18n.t('dash.total') }}</span>
                    </div>
                  </div>
                  <ul class="flex-1 w-full space-y-1.5 min-w-0">
                    @for (e of estados(); track e.value) {
                      <li class="flex items-center gap-2 text-sm min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="e.color"></span>
                        <span class="truncate min-w-0" style="opacity: 0.85;">{{ e.label }}</span>
                        <span class="ml-auto font-medium">{{ e.count }}</span>
                        <span class="text-xs w-10 text-right" style="opacity: 0.5;">{{ e.pct }}%</span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
            <!-- Por categoría -->
            <div class="card">
              <h3 class="text-sm font-semibold mb-3">{{ i18n.t('dash.byCategoria') }}</h3>
              @if (categorias().length === 0) {
                <p class="text-sm py-4 text-center" style="opacity: 0.4;">{{ i18n.t('dash.empty') }}</p>
              } @else {
                <ul class="space-y-2">
                  @for (c of categorias(); track c.label) {
                    <li>
                      <div class="flex items-center justify-between text-sm mb-1">
                        <span class="truncate" style="opacity: 0.85;">{{ c.label }}</span>
                        <span class="text-xs" style="opacity: 0.5;">{{ c.count }} · {{ c.pct }}%</span>
                      </div>
                      <div class="rounded-sm h-2" style="background: var(--surface-hover);">
                        <div class="h-2 rounded-sm" [style.width]="c.pct + '%'" [style.background]="c.color"></div>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
            <!-- Por idioma -->
            <div class="card">
              <h3 class="text-sm font-semibold mb-3">{{ i18n.t('dash.byIdioma') }}</h3>
              @if (idiomas().length === 0) {
                <p class="text-sm py-4 text-center" style="opacity: 0.4;">{{ i18n.t('dash.empty') }}</p>
              } @else {
                <ul class="space-y-2">
                  @for (c of idiomas(); track c.label) {
                    <li>
                      <div class="flex items-center justify-between text-sm mb-1">
                        <span class="truncate" style="opacity: 0.85;">{{ c.label }}</span>
                        <span class="text-xs" style="opacity: 0.5;">{{ c.count }} · {{ c.pct }}%</span>
                      </div>
                      <div class="rounded-sm h-2" style="background: var(--surface-hover);">
                        <div class="h-2 rounded-sm" [style.width]="c.pct + '%'" [style.background]="c.color"></div>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
      }
    </div>
  `,
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
  loading = signal(true);
  all = signal<Postulacion[]>([]);
  tags = signal<Tag[]>([]);
  categoriasList = signal<Categoria[]>([]);
  idiomasList = signal<Idioma[]>([]);

  quick = signal<Quick>('all');
  from = signal<Date | null>(null);
  to = signal<Date | null>(null);
  quickOpts: Quick[] = ['today', 'week', 'month', 'all'];

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
    this.api.getPostulaciones({ trashed: false }).subscribe(d => { this.all.set(d); check(); });
    this.api.getTags().subscribe(d => { this.tags.set(d); check(); });
    this.api.getCategorias().subscribe(d => { this.categoriasList.set(d); check(); });
    this.api.getIdiomas().subscribe(d => { this.idiomasList.set(d); check(); });
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
      const to = now;
      const from = new Date(to.getTime() - 6 * day);
      const prevTo = new Date(from.getTime() - day);
      const prevFrom = new Date(prevTo.getTime() - 6 * day);
      cur = this.countRange(from, to);
      prev = this.countRange(prevFrom, prevTo);
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
    if (!value) return this.i18n.t('dash.sinEstado');
    return this.i18n.tagLabel(value);
  }
  private stateColor(value: string) {
    if (!value) return 'var(--surface-hover)';
    return this.tags().find(t => t.nombre === value)?.color || 'var(--surface-hover)';
  }
  estados = computed<EstadoGroup[]>(() => {
    const map = new Map<string, number>();
    for (const p of this.all()) {
      const key = p.estado;
      map.set(key, (map.get(key) || 0) + 1);
    }
    const total = this.all().length || 1;
    return [...map.entries()].map(([value, count]) => ({
      value: value || '__sin__',
      label: this.stateLabel(value),
      color: this.stateColor(value),
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