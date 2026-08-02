import { Component } from '@angular/core';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  template: `
    @if (dialog.state().open && dialog.state().type === 'confirm') {
      <div class="fixed inset-0 z-[100] flex items-center justify-center" style="background: rgba(0,0,0,0.3);" (click)="cancel()">
        <div class="card mx-4 max-w-sm w-full animate-fade-in" (click)="$event.stopPropagation()">
          <p class="text-sm mb-4">{{ dialog.state().message }}</p>
          <div class="flex justify-end gap-2">
            <button class="btn btn-outline" (click)="cancel()">Cancelar</button>
            <button class="btn btn-primary" (click)="ok()">Aceptar</button>
          </div>
        </div>
      </div>
    }
    @if (dialog.state().open && dialog.state().type === 'toast') {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm text-white z-[100] animate-slide-up" style="background: var(--accent);">
        {{ dialog.state().message }}
      </div>
    }
  `,
})
export class DialogComponent {
  constructor(public dialog: DialogService) {}

  ok() {
    this.dialog.state().resolve?.(true);
    this.dialog.state.set({ open: false, type: 'confirm', message: '' });
  }

  cancel() {
    this.dialog.state().resolve?.(false);
    this.dialog.state.set({ open: false, type: 'confirm', message: '' });
  }
}
