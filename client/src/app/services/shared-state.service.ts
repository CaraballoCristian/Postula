import { Injectable, signal, effect } from '@angular/core';
import { TabName } from '../models/interfaces';

const TABS: TabName[] = ['dashboard', 'postular', 'historial', 'templates', 'config'];

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  activeTab = signal<TabName>('dashboard');
  historialRefresh = signal(0);
  configRefresh = signal(0);
  templatesRefresh = signal(0);
  tagsRefresh = signal(0);
  categoriasRefresh = signal(0);
  idiomasRefresh = signal(0);
  empresasRefresh = signal(0);

  constructor() {
    const saved = localStorage.getItem('postulatool.tab') as TabName | null;
    if (saved && TABS.includes(saved)) this.activeTab.set(saved);
    effect(() => localStorage.setItem('postulatool.tab', this.activeTab()));
  }
}
