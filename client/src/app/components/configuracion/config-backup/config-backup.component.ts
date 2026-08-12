import { Component, signal } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { DialogService } from '../../../services/dialog.service';
import { SharedStateService } from '../../../services/shared-state.service';
import { I18nService } from '../../../services/i18n.service';
import { firstValueFrom } from 'rxjs';
import { ImportConflictComponent, ImportConflictGroup, ImportChoice } from '../../import-conflict/import-conflict.component';
import { markErrorHandled } from '../../../interceptors/error.interceptor';

@Component({
  selector: 'app-config-backup',
  standalone: true,
  imports: [ImportConflictComponent],
  templateUrl: './config-backup.component.html',
})
export class ConfigBackupComponent {
  importReview = signal<{ data: any; groups: ImportConflictGroup[] } | null>(null);
  importBusy = signal(false);

  constructor(
    private api: ApiService,
    private dialog: DialogService,
    private shared: SharedStateService,
    public i18n: I18nService,
  ) {}

  async exportBackup() {
    const data = await firstValueFrom(this.api.exportBackup()) as any;
    if (data == null) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const suggestedName = `postulatool-backup-${Date.now()}.json`;

    // File System Access API: abre SIEMPRE el diálogo nativo para elegir dónde/con qué nombre (Chrome/Edge inclusive la PWA).
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === 'function') {
      try {
        const handle = await picker.call(window, { suggestedName, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.dialog.toast(this.i18n.t('backup.exportDone'));
        return;
      } catch (err: any) {
        // Cancelación del diálogo o error no bloqueante: no mostrar toast de error.
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback (Firefox/Safari): descarga directa a la carpeta de descargas.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.dialog.toast(this.i18n.t('backup.exportDone'));
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        const ok = await this.dialog.confirm(this.i18n.t('backup.importConfirm'));
        if (!ok) { input.value = ''; return; }
        this.api.importPreview(data).subscribe({
          next: (res: any) => {
            const groups = (res?.groups ?? []) as ImportConflictGroup[];
            const conflicted = groups.some(g => g.conflictLink || g.conflictMensaje || (g.postConflicts?.length ?? 0) > 0);
            if (!conflicted) {
              this.doImport(data, {});
            } else {
              this.importReview.set({ data, groups });
            }
          },
          error: (err: any) => { markErrorHandled(err); console.error('[backup] import preview error', err?.message, err?.status); this.dialog.toast(this.i18n.t('backup.importError'), 'error'); },
        });
      } catch {
        this.dialog.toast(this.i18n.t('backup.importError'), 'error');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  cancelImport() {
    this.importReview.set(null);
    this.importBusy.set(false);
  }

  confirmImport(choices: Record<string, ImportChoice>) {
    const review = this.importReview();
    if (!review) return;
    this.doImport(review.data, choices);
  }

  doImport(data: any, decisions: Record<string, ImportChoice>) {
    this.importBusy.set(true);
    this.api.importBackup(data, decisions).subscribe({
      next: () => {
        this.importBusy.set(false);
        this.importReview.set(null);
        this.dialog.toast(this.i18n.t('backup.importDone'));
        this.shared.configRefresh.update(v => v + 1);
        this.shared.categoriasRefresh.update(v => v + 1);
        this.shared.idiomasRefresh.update(v => v + 1);
        this.shared.tagsRefresh.update(v => v + 1);
        this.shared.templatesRefresh.update(v => v + 1);
        this.shared.historialRefresh.update(v => v + 1);
        this.shared.empresasRefresh.update(v => v + 1);
      },
      error: (err: any) => {
        markErrorHandled(err);
        console.error('[backup] import preview/import error', err?.message, err?.status);
        this.importBusy.set(false);
        this.dialog.toast(this.i18n.t('backup.importError'), 'error');
      },
    });
  }
}