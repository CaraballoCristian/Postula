import { Injectable, signal } from '@angular/core';

export interface DialogState {
  open: boolean;
  type: 'confirm' | 'toast';
  message: string;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  state = signal<DialogState>({ open: false, type: 'confirm', message: '' });

  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.state.set({ open: true, type: 'confirm', message, resolve });
    });
  }

  toast(message: string) {
    this.state.set({ open: true, type: 'toast', message });
    setTimeout(() => this.state.set({ open: false, type: 'confirm', message: '' }), 2500);
  }
}
