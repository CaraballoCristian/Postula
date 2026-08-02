import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy } from '@angular/core';

const activeDropdownId = signal<string | null>(null);

@Component({
  selector: 'app-dropdown',
  standalone: true,
  template: `
    <div class="relative">
      <button class="text-sm flex items-center justify-between pl-2 pr-1 py-1.5 rounded-md cursor-pointer border w-full"
        style="border-color: var(--border); background: var(--surface); color: var(--text);"
        (click)="toggle(); $event.stopPropagation()">
        <span [style.opacity]="label() ? '1' : '0.4'">{{ label() }}</span>
        <span>▾</span>
      </button>
      @if (open()) {
        <div class="absolute top-full left-0 mt-1 z-20 w-full shadow-lg" style="background: var(--surface); border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.25rem;"
          (click)="$event.stopPropagation()">
          @for (opt of options; track opt.value; let i = $index) {
            <div class="px-2.5 py-1.5 rounded cursor-pointer text-sm"
              [style.background]="(hoverIdx === i) || selected === opt.value ? 'var(--surface-hover)' : 'transparent'"
              (mouseenter)="hoverIdx = i"
              (mouseleave)="hoverIdx = null"
              (click)="select(opt.value)">
              {{ opt.label }}
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DropdownComponent implements OnInit, OnDestroy {
  @Input() options: { value: any; label: string }[] = [];
  @Input() selected: any = null;
  @Input() placeholder = '';
  @Input() id = '';
  @Output() selectedChange = new EventEmitter<any>();

  open() { return activeDropdownId() === this.id; }
  hoverIdx: number | null = null;

  private _clickListener: any;

  ngOnInit() {
    this._clickListener = () => activeDropdownId.set(null);
    document.addEventListener('click', this._clickListener);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this._clickListener);
  }

  label(): string {
    if (this.selected !== null && this.selected !== undefined && this.selected !== '') {
      const opt = this.options.find(o => o.value === this.selected);
      if (opt) return opt.label;
    }
    return this.placeholder || '';
  }

  toggle() {
    activeDropdownId.set(this.open() ? null : this.id);
  }

  select(value: any) {
    this.selected = value;
    this.selectedChange.emit(value);
    activeDropdownId.set(null);
  }
}
