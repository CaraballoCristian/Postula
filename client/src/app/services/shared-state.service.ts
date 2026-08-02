import { Injectable, signal } from '@angular/core';
import { TabName } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  activeTab = signal<TabName>('postular');
  historialRefresh = signal(0);
  configRefresh = signal(0);
  templatesRefresh = signal(0);
  tagsRefresh = signal(0);
  categoriasRefresh = signal(0);
  idiomasRefresh = signal(0);
}
