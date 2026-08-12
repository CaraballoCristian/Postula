import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DropdownComponent } from './dropdown.component';

describe('DropdownComponent', () => {
  let fixture: ComponentFixture<DropdownComponent>;
  let comp: DropdownComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(DropdownComponent);
    comp = fixture.componentInstance;
    comp.options = [
      { value: 'a', label: 'Opción A' },
      { value: 'b', label: 'Opción B' },
    ];
    fixture.detectChanges();
  });

  it('label() muestra el placeholder si no hay selección', () => {
    comp.placeholder = 'Elegir...';
    comp.selected = null;
    expect(comp.label()).toBe('Elegir...');
  });

  it('label() muestra la etiqueta de la opción seleccionada', () => {
    comp.selected = 'b';
    expect(comp.label()).toBe('Opción B');
  });

  it('label() cae al placeholder si el valor no existe en las opciones', () => {
    comp.selected = 'zz';
    comp.placeholder = 'Nada';
    expect(comp.label()).toBe('Nada');
  });

  it('toggle() abre y cierra según el id único', () => {
    comp.id = 'dd1';
    expect(comp.open()).toBeFalse();
    comp.toggle();
    expect(comp.open()).toBeTrue();
    comp.toggle();
    expect(comp.open()).toBeFalse();
  });

  it('select() emite el valor y cierra', () => {
    comp.id = 'dd2';
    comp.toggle();
    let emitted: any = 'n/a';
    comp.selectedChange.subscribe((v) => (emitted = v));
    comp.select('a');
    expect(emitted).toBe('a');
    expect(comp.selected).toBe('a');
    expect(comp.open()).toBeFalse();
  });

  it('un click global cierra el dropdown abierto', () => {
    comp.id = 'dd3';
    comp.toggle();
    expect(comp.open()).toBeTrue();
    document.dispatchEvent(new Event('click'));
    expect(comp.open()).toBeFalse();
  });
});