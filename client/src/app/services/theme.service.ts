import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  accentColor = signal('#2563eb');
  isDark = signal(true);

  constructor() {
    const savedAccent = localStorage.getItem('accent-color');
    const savedDark = localStorage.getItem('dark-mode');

    if (savedAccent) this.accentColor.set(savedAccent);
    if (savedDark) this.isDark.set(savedDark === 'true');

    effect(() => {
      const el = document.documentElement;
      el.style.setProperty('--accent', this.accentColor());
      el.style.setProperty('--accent-root', this.accentColor());
      if (this.isDark()) {
        el.classList.add('dark');
      } else {
        el.classList.remove('dark');
      }
    });

    effect(() => localStorage.setItem('accent-color', this.accentColor()));
    effect(() => localStorage.setItem('dark-mode', String(this.isDark())));
  }
}
