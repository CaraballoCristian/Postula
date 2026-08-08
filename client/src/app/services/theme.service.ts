import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  accentColor = signal('#2563eb');
  isDark = signal(true);

  // 'full' → app en pantalla completa (modo PWA); 'framed' → franja centrada (modo web)
  layoutMode = signal<'full' | 'framed'>(window.matchMedia('(display-mode: standalone)').matches ? 'full' : 'framed');

  constructor() {
    const savedAccent = localStorage.getItem('accent-color');
    const savedDark = localStorage.getItem('dark-mode');
    const savedLayout = localStorage.getItem('layout-mode');

    if (savedAccent) this.accentColor.set(savedAccent);
    if (savedDark) this.isDark.set(savedDark === 'true');
    if (savedLayout) this.layoutMode.set(savedLayout === 'full' ? 'full' : 'framed');

    effect(() => {
      const el = document.documentElement;
      el.style.setProperty('--accent', this.accentColor());
      el.style.setProperty('--accent-root', this.accentColor());
      el.style.setProperty('--accent-contrast', contrastText(this.accentColor()));
      if (this.isDark()) {
        el.classList.add('dark');
      } else {
        el.classList.remove('dark');
      }
    });

    effect(() => localStorage.setItem('accent-color', this.accentColor()));
    effect(() => localStorage.setItem('dark-mode', String(this.isDark())));
    effect(() => localStorage.setItem('layout-mode', this.layoutMode()));
  }
}

// Devuelve el texto que mejor contrasta sobre un color de fondo dado (WCAG).
function contrastText(hex: string): string {
  const parsed = parseHex(hex);
  if (parsed == null) return '#ffffff';
  const [r, g, b] = parsed;
  // Luminancia relativa según WCAG 2.x.
  const lum = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  // Punto de equilibrio entre blanco y un oscuro de luminancia ~0.0064 (slate-900).
  return lum > 0.192 ? '#0f172a' : '#ffffff';
}

function parseHex(hex: string): [number, number, number] | null {
  let h = String(hex || '').replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function linearize(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
