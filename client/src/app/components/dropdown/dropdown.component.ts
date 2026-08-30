import { Component, Input, Output, EventEmitter, signal, computed, effect, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

const activeDropdownId = signal<string | null>(null);

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dropdown.component.html',
})
export class DropdownComponent implements OnInit, OnDestroy {
  @Input() options: { value: any; label: string }[] = [];
  @Input() selected: any = null;
  @Input() placeholder = '';
  @Input() id = '';
  @Input() searchable = false;
  @Output() selectedChange = new EventEmitter<any>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  filterText = signal('');
  filteredOptions = computed(() => {
    const q = this.filterText().toLowerCase().trim();
    if (!q) return this.options;
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  });

  open() { return activeDropdownId() === this.id; }
  highlightIdx = signal(0);

  private _clickListener: any;

  constructor() {
    // Mantiene el resaltado dentro de la lista filtrada (al escribir se recorta).
    effect(() => {
      const opts = this.filteredOptions();
      if (this.highlightIdx() >= opts.length) this.highlightIdx.set(0);
    });
  }

  ngOnInit() {
    this._clickListener = () => { activeDropdownId.set(null); this.filterText.set(''); };
    document.addEventListener('click', this._clickListener);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this._clickListener);
  }

  label(): string {
    if (this.selected !== null && this.selected !== undefined && this.selected !== '') {
      const sel: any = this.selected;
      const byId = typeof sel === 'object' && sel !== null && 'id' in sel;
      const opt = byId
        ? this.options.find(o => (o.value as any)?.id === sel.id)
        : this.options.find(o => o.value === this.selected);
      if (opt) return opt.label;
    }
    return this.placeholder || '';
  }

  toggle() {
    activeDropdownId.set(this.open() ? null : this.id);
    this.filterText.set('');
    this.highlightIdx.set(0);
    if (this.open() && this.searchable) {
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    }
  }

  onKeydown(e: KeyboardEvent) {
    if (!this.open()) return;
    const opts = this.filteredOptions();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (opts.length === 0) return;
      this.highlightIdx.update(i => Math.min(i + 1, opts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (opts.length === 0) return;
      this.highlightIdx.update(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = opts[this.highlightIdx()];
      if (opt) this.select(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      activeDropdownId.set(null);
      this.filterText.set('');
    }
  }

  select(value: any) {
    this.selected = value;
    this.selectedChange.emit(value);
    activeDropdownId.set(null);
    this.filterText.set('');
  }
}
