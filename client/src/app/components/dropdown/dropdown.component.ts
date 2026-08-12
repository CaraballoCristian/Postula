import { Component, Input, Output, EventEmitter, signal, OnInit, OnDestroy } from '@angular/core';

const activeDropdownId = signal<string | null>(null);

@Component({
  selector: 'app-dropdown',
  standalone: true,
  templateUrl: './dropdown.component.html',
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
