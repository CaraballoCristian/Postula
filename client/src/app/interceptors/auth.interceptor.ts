import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const token = session.token();

  let request = req;
  if (token) {
    request = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(request).pipe(
    catchError((err) => {
      // Sesión vencida o inválida: cerrar sesión para volver al login.
      if (err.status === 401 && session.token()) {
        session.logout();
      }
      return throwError(() => err);
    })
  );
};
