import { Component, signal, effect } from '@angular/core';
import { SharedStateService } from '../../services/shared-state.service';
import { I18nService } from '../../services/i18n.service';
import { ConfigDatosComponent } from './config-datos/config-datos.component';
import { ConfigCategoriasComponent } from './config-categorias/config-categorias.component';
import { ConfigIdiomasComponent } from './config-idiomas/config-idiomas.component';
import { ConfigTagsComponent } from './config-tags/config-tags.component';
import { ConfigBackupComponent } from './config-backup/config-backup.component';
import { ConfigSeguridadComponent } from './config-seguridad/config-seguridad.component';

type ConfigSection = 'datos' | 'categorias' | 'idiomas' | 'tags' | 'backup' | 'seguridad';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [ConfigDatosComponent, ConfigCategoriasComponent, ConfigIdiomasComponent, ConfigTagsComponent, ConfigBackupComponent, ConfigSeguridadComponent],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent {
  activeSection = signal<ConfigSection>('datos');
  sections: { id: ConfigSection; labelKey: any }[] = [
    { id: 'datos', labelKey: 'cfg.section.datos' },
    { id: 'categorias', labelKey: 'cfg.section.categorias' },
    { id: 'idiomas', labelKey: 'cfg.section.idiomas' },
    { id: 'tags', labelKey: 'cfg.section.tags' },
    { id: 'backup', labelKey: 'backup.section' },
    { id: 'seguridad', labelKey: 'auth.section.security' },
  ];

  constructor(
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {
    // Al entrar a la pestaña de configuración, refrescar cada sección una vez.
    effect(() => {
      if (this.shared.activeTab() === 'config') {
        this.shared.configRefresh.update(v => v + 1);
        this.shared.categoriasRefresh.update(v => v + 1);
        this.shared.idiomasRefresh.update(v => v + 1);
        this.shared.tagsRefresh.update(v => v + 1);
        this.shared.templatesRefresh.update(v => v + 1);
      }
    });
  }
}