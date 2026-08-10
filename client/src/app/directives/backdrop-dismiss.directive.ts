import { Directive, ElementRef, HostListener, output } from '@angular/core';

/**
 * Permite cerrar un modal solo cuando el click es claramente intencional:
 * el mousedown Y el mouseup deben caer sobre el backdrop (fuera de la card).
 * Un click que empieza dentro del modal y termina afuera NO cierra.
 * Uso: overlay raíz del modal -> [backdropDismiss] (dismissed)="close()"
 */
@Directive({
  selector: '[backdropDismiss]',
  standalone: true,
})
export class BackdropDismissDirective {
  readonly dismissed = output<void>();
  private startedOnBackdrop = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    this.startedOnBackdrop = e.target === this.el.nativeElement;
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(e: MouseEvent) {
    const intent = this.startedOnBackdrop && e.target === this.el.nativeElement;
    this.startedOnBackdrop = false;
    if (intent) this.dismissed.emit();
  }
}