import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor, markErrorHandled } from './error.interceptor';
import { DialogService } from '../services/dialog.service';
import { I18nService } from '../services/i18n.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let dialog: DialogService;
  let i18n: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    dialog = TestBed.inject(DialogService);
    i18n = TestBed.inject(I18nService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushError(status: number, body?: unknown) {
    const req = httpMock.expectOne('/api/test');
    req.flush(body ?? { message: 'boom' }, { status, statusText: 'Error' });
  }

  it('muestra toast genérico cuando nadie maneja el error (≠401)', fakeAsync(() => {
    http.get('/api/test').subscribe({ error: () => {} });
    flushError(500);
    expect(dialog.state().open).toBeFalse();
    tick(50);
    expect(dialog.state().open).toBeTrue();
    expect(dialog.state().kind).toBe('error');
    expect(dialog.state().message).toBe(i18n.t('common.error.request'));
  }));

  it('no muestra toast si el manejador local marcó el error', fakeAsync(() => {
    http.get('/api/test').subscribe({
      error: (err) => { markErrorHandled(err); },
    });
    flushError(500);
    tick(50);
    expect(dialog.state().open).toBeFalse();
  }));

  it('no muestra toast en 401 (lo gestiona authInterceptor)', fakeAsync(() => {
    http.get('/api/test').subscribe({ error: () => {} });
    flushError(401);
    tick(50);
    expect(dialog.state().open).toBeFalse();
  }));

  it('repropaga el error original al suscriptor', () => {
    let caught: HttpErrorResponse | undefined;
    http.get('/api/test').subscribe({ error: (err) => { caught = err; } });
    flushError(503);
    expect(caught).toBeInstanceOf(HttpErrorResponse);
    expect(caught?.status).toBe(503);
  });
});