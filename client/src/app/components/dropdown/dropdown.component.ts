import { Component, Input, Output, EventEmitter, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
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
  hoverIdx: number | null = null;

  private _clickListener: any;

  ngOnInit() {
    this._clickListener = () => { activeDropdownId.set(null); this.filterText.set(''); };
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
    this.filterText.set('');
    if (this.open() && this.searchable) {
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    }
  }

  select(value: any) {
    this.selected = value;
    this.selectedChange.emit(value);
    activeDropdownId.set(null);
    this.filterText.set('');
  }
}
