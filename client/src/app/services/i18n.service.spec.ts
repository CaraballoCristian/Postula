import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let svc: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(I18nService);
  });

  it('default es español', () => {
    expect(svc.lang()).toBe('es');
  });

  it('t() traduce y soporta {{param}}', () => {
    expect(svc.t('backup.import')).toBe('Restaurar backup');
    expect(svc.t('dash.totalHint', { month: '5', all: '42' })).toBe('5 este mes · 42 en total');
  });

  it('t() no interpola llaves simples ({oferta} en backup.postTitle)', () => {
    // Inconsistencia del template actual: backup.postTitle usa {oferta}, no {{oferta}}.
    expect(svc.t('backup.postTitle', { oferta: 'Dev' })).toBe('Postulación {oferta}');
  });

  it('t() devuelve la clave si el idioma no la tiene', () => {
    svc.setLang('en');
    expect(svc.t('clave.inexistente' as any)).toBe('clave.inexistente');
  });

  it('setLang cambia y persiste', () => {
    svc.setLang('en');
    TestBed.flushEffects();
    expect(svc.lang()).toBe('en');
    expect(localStorage.getItem('postulatool.lang')).toBe('en');
  });

  it('tagLabel traduce los default de seed', () => {
    svc.setLang('es');
    expect(svc.tagLabel('en_proceso')).toBe('En proceso');
    svc.setLang('en');
    expect(svc.tagLabel('en_proceso')).toBe('In progress');
  });

  it('tagLabel normaliza etiquetas propias con cap()', () => {
    svc.setLang('es');
    expect(svc.tagLabel('otra_etiqueta')).toBe('Otra Etiqueta');
  });

  it('categoriaLabel traduce Tech/Management', () => {
    expect(svc.categoriaLabel('Tech')).toBe('Tecnología');
    svc.setLang('en');
    expect(svc.categoriaLabel('Tech')).toBe('Tech');
  });

  it('cap convierte underscores y capitaliza', () => {
    expect(svc.cap('hola_mundo')).toBe('Hola Mundo');
    expect(svc.cap('ya capitalizado')).toBe('Ya Capitalizado');
  });
});