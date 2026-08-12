import { Component, HostListener } from '@angular/core';
import { DialogService } from '../../services/dialog.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
})
export class DialogComponent {
  constructor(public dialog: DialogService, public i18n: I18nService) {}

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.dialog.state().open && this.dialog.state().type === 'confirm') this.cancel();
  }

  ok() {
    this.dialog.state().resolve?.(true);
    this.dialog.state.set({ open: false, type: 'confirm', message: '' });
  }

  cancel() {
    this.dialog.state().resolve?.(false);
    this.dialog.state.set({ open: false, type: 'confirm', message: '' });
  }
}