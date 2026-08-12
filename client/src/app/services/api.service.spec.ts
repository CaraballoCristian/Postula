import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let svc: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('login hace POST /api/auth/login', () => {
    svc.login('a@b.com', 'secret').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    req.flush({ token: 't', user: { id: 1, email: 'a@b.com' } });
  });

  it('register hace POST /api/auth/register', () => {
    svc.register('a@b.com', 'secret').subscribe();
    const req = http.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('a@b.com');
    req.flush({ token: 't', user: { id: 1, email: 'a@b.com' } });
  });

  it('getPostulaciones pasa trashed como 1/0', () => {
    svc.getPostulaciones({ trashed: true }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/postulaciones');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('trashed')).toBe('1');
    req.flush([]);

    svc.getPostulaciones({ trashed: false }).subscribe();
    const req2 = http.expectOne((r) => r.url === '/api/postulaciones');
    expect(req2.request.params.get('trashed')).toBe('0');
    req2.flush([]);
  });

  it('deleteTag envía body.dest cuando se indica', () => {
    svc.deleteTag(5, 9).subscribe();
    const req = http.expectOne((r) => r.url === '/api/tags/5');
    expect(req.request.method).toBe('DELETE');
    expect((req.request.body as any).dest).toBe(9);
    req.flush({ ok: true });
  });

  it('deleteTag sin dest no envía body', () => {
    svc.deleteTag(5).subscribe();
    const req = http.expectOne((r) => r.url === '/api/tags/5');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush({ ok: true });
  });

  it('updateTag envía {nombre, color, propagate}', () => {
    svc.updateTag(3, { nombre: 'x', color: '#fff', propagate: true }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/tags/3');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'x', color: '#fff', propagate: true });
    req.flush({ id: 3 });
  });

  it('importBackup envía {data, decisions}', () => {
    const data = { categorias: [] };
    const decisions = { x: { link: 'existing', mensaje: 'imported' } as const };
    svc.importBackup(data, decisions).subscribe();
    const req = http.expectOne((r) => r.url === '/api/backup/import');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ data, decisions });
    req.flush({ ok: true });
  });

  it('exportBackup hace GET /api/backup/export', () => {
    svc.exportBackup().subscribe();
    const req = http.expectOne('/api/backup/export');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('deletePostulacion hard envía ?mode=hard', () => {
    svc.deletePostulacion(4, 'hard').subscribe();
    const req = http.expectOne((r) => r.url === '/api/postulaciones/4');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('mode')).toBe('hard');
    req.flush({ ok: true });
  });
});