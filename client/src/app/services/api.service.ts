import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Categoria, Template, ConfigEntry, Postulacion, PostulacionPayload, Idioma, Tag, User, AuthResponse } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  constructor(private http: HttpClient) {}

  // ── Auth ──
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password });
  }
  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, { email, password });
  }
  me(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.base}/auth/me`);
  }
  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/auth/change-password`, { currentPassword, newPassword });
  }

  // ── Categorías ──
  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.base}/categorias`);
  }
  createCategoria(nombre: string): Observable<Categoria> {
    return this.http.post<Categoria>(`${this.base}/categorias`, { nombre });
  }
  updateCategoria(id: number, nombre: string): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.base}/categorias/${id}`, { nombre });
  }
  setDefaultCategoria(id: number): Observable<any> {
    return this.http.put(`${this.base}/categorias/${id}/default`, {});
  }
  deleteCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.base}/categorias/${id}`);
  }

  // ── Idiomas ──
  getIdiomas(): Observable<Idioma[]> {
    return this.http.get<Idioma[]>(`${this.base}/idiomas`);
  }
  createIdioma(nombre: string): Observable<Idioma> {
    return this.http.post<Idioma>(`${this.base}/idiomas`, { nombre });
  }
  updateIdioma(id: number, nombre: string): Observable<Idioma> {
    return this.http.put<Idioma>(`${this.base}/idiomas/${id}`, { nombre });
  }
  setDefaultIdioma(id: number): Observable<any> {
    return this.http.put(`${this.base}/idiomas/${id}/default`, {});
  }
  deleteIdioma(id: number): Observable<any> {
    return this.http.delete(`${this.base}/idiomas/${id}`);
  }

  // ── Tags ──
  getTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.base}/tags`);
  }
  createTag(nombre: string, color: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.base}/tags`, { nombre, color });
  }
  updateTag(id: number, data: { nombre?: string; color?: string; propagate?: boolean }): Observable<Tag> {
    return this.http.put<Tag>(`${this.base}/tags/${id}`, data);
  }
  deleteTag(id: number, dest?: number): Observable<any> {
    return this.http.delete(`${this.base}/tags/${id}`, dest !== undefined ? { body: { dest } } : {});
  }

  // ── Templates ──
  getTemplates(filters?: { categoria_id?: number; idioma?: string; tipo?: string }): Observable<Template[]> {
    let params: any = {};
    if (filters) params = filters;
    return this.http.get<Template[]>(`${this.base}/templates`, { params });
  }
  getTemplate(id: number): Observable<Template> {
    return this.http.get<Template>(`${this.base}/templates/${id}`);
  }
  createTemplate(data: Partial<Template>): Observable<Template> {
    return this.http.post<Template>(`${this.base}/templates`, data);
  }
  updateTemplate(id: number, data: Partial<Template>): Observable<Template> {
    return this.http.put<Template>(`${this.base}/templates/${id}`, data);
  }
  deleteTemplate(id: number): Observable<any> {
    return this.http.delete(`${this.base}/templates/${id}`);
  }

  // ── Config ──
  getConfig(): Observable<ConfigEntry[]> {
    return this.http.get<ConfigEntry[]>(`${this.base}/config`);
  }
  createConfig(clave: string, valor: string): Observable<ConfigEntry> {
    return this.http.post<ConfigEntry>(`${this.base}/config`, { clave, valor });
  }
  updateConfig(id: number, data: { clave?: string; valor?: string }): Observable<ConfigEntry> {
    return this.http.put<ConfigEntry>(`${this.base}/config/${id}`, data);
  }
  deleteConfig(id: number): Observable<any> {
    return this.http.delete(`${this.base}/config/${id}`);
  }

  // ── Postulaciones ──
  getPostulaciones(filters?: { empresa?: string; categoria_id?: number; trashed?: boolean }): Observable<Postulacion[]> {
    let params: any = {};
    if (filters) {
      params = { ...filters };
      if (params.trashed !== undefined) { params.trashed = params.trashed ? '1' : '0'; }
    }
    return this.http.get<Postulacion[]>(`${this.base}/postulaciones`, { params });
  }
  createPostulacion(data: PostulacionPayload): Observable<Postulacion> {
    return this.http.post<Postulacion>(`${this.base}/postulaciones`, data);
  }
  updatePostulacion(id: number, data: Partial<PostulacionPayload>): Observable<Postulacion> {
    return this.http.put<Postulacion>(`${this.base}/postulaciones/${id}`, data);
  }
  deletePostulacion(id: number, mode?: 'soft' | 'hard'): Observable<any> {
    return this.http.delete(`${this.base}/postulaciones/${id}`, mode === 'hard' ? { params: { mode: 'hard' } } : {});
  }
  restorePostulacion(id: number): Observable<Postulacion> {
    return this.http.post<Postulacion>(`${this.base}/postulaciones/${id}/restore`, {});
  }

  // ── Backup (export / import) ──
  exportBackup(): Observable<any> {
    return this.http.get(`${this.base}/backup/export`, { responseType: 'json' });
  }
  importBackup(data: any): Observable<any> {
    return this.http.post(`${this.base}/backup/import`, { data });
  }
}
