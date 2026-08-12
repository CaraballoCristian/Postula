import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { DialogService } from '../services/dialog.service';
import { I18nService } from '../services/i18n.service';

// Marca para saber si un handler local (componente) ya notificó el error.
// Sin declaración global para no contaminar HttpErrorResponse con tipos extra.
const HANDLED = Symbol('error-already-handled-locally');

/** Marca un error como ya notificado por el componente (evita doble toast). */
export function markErrorHandled(err: unknown) {
  if (err && typeof err === 'object') {
    (err as Record<symbol, boolean>)[HANDLED] = true;
  }
}

// Interceptores con `HttpInterceptorFn` en orden de ejecución: primero authInterceptor
// (logout en 401) y luego los errores que además son silenciosos. `DialogService` y
// `I18nService` deben estar disponibles en la DI (test tsconfig enlaza estas deps).
export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const dialog = inject(DialogService);
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 lo maneja authInterceptor (cierra sesión); no abrir toast sobre el login.
      if (err.status !== 401 && !(err as unknown as Record<symbol, boolean>)[HANDLED]) {
        // Diferido (macrotask): el manejador del suscriptor ya corrió y pudo marcar el error,
        // así los flujos con notificación local no muestran un segundo toast.
        setTimeout(() => {
          if (!(err as unknown as Record<symbol, boolean>)[HANDLED]) {
            dialog.toast(i18n.t('common.error.request'), 'error');
          }
        }, 0);
      }
      return throwError(() => err);
    }),
  );
}