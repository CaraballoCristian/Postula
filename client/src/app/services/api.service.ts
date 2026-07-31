import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Categoria, Template, ConfigEntry, Postulacion, PostulacionPayload } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  constructor(private http: HttpClient) {}

  // ── Categorías ──
  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.base}/categorias`);
  }
  createCategoria(nombre: string): Observable<Categoria> {
    return this.http.post<Categoria>(`${this.base}/categorias`, { nombre });
  }
  deleteCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.base}/categorias/${id}`);
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
  reorderTemplate(id: number, new_orden: number): Observable<Template[]> {
    return this.http.patch<Template[]>(`${this.base}/templates/${id}/reorder`, { new_orden });
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
  getPostulaciones(filters?: { empresa?: string; categoria_id?: number }): Observable<Postulacion[]> {
    let params: any = {};
    if (filters) params = filters;
    return this.http.get<Postulacion[]>(`${this.base}/postulaciones`, { params });
  }
  createPostulacion(data: PostulacionPayload): Observable<Postulacion> {
    return this.http.post<Postulacion>(`${this.base}/postulaciones`, data);
  }
  deletePostulacion(id: number): Observable<any> {
    return this.http.delete(`${this.base}/postulaciones/${id}`);
  }
}
