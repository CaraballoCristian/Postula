import { Injectable, signal, effect } from '@angular/core';
import { ApiService } from './api.service';
import { SharedStateService } from './shared-state.service';
import { Template } from '../models/interfaces';

/** Cache compartida de templates del usuario, usada por los contadores de config. */
@Injectable({ providedIn: 'root' })
export class TemplatesCacheService {
  items = signal<Template[]>([]);

  constructor(private api: ApiService, private shared: SharedStateService) {
    // Se mantiene fresca mientras la pestaña de configuración esté activa.
    effect(() => {
      void this.shared.templatesRefresh();
      if (this.shared.activeTab() === 'config') this.load();
    });
  }

  load() {
    this.api.getTemplates().subscribe(d => this.items.set(d));
  }
}