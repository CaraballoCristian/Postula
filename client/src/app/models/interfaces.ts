export interface Categoria {
  id: number;
  nombre: string;
  created_at: string;
}

export interface Template {
  id: number;
  categoria_id: number;
  idioma: string;
  tipo: 'email' | 'mensaje_empresa' | 'mensaje_recruiter';
  nombre: string;
  contenido: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigEntry {
  id: number;
  clave: string;
  valor: string;
}

export interface Postulacion {
  id: number;
  empresa: string;
  oferta_laboral: string;
  categoria_id: number | null;
  idioma: string | null;
  nombre_empleado: string;
  puesto_empleado: string;
  template_ids: number[];
  valores_usados: Record<string, string>;
  resultado_email: string | null;
  resultado_empresa: string | null;
  resultado_recruiter: string | null;
  notas: string;
  estado: 'solicitado' | 'mensajeado' | 'en_proceso' | 'rechazado' | 'pendiente';
  link_empresa: string;
  contacto_empleado: string;
  favorito: number;
  fecha: string;
  created_at: string;
  deleted_at?: string | null;
}

export const TIPOS_MENSAJE: Template['tipo'][] = ['email', 'mensaje_empresa', 'mensaje_recruiter'];

export const TIPO_LABELS: Record<Template['tipo'], string> = {
  email: 'Email',
  mensaje_empresa: 'Empresa',
  mensaje_recruiter: 'Empleado',
};

export const TIPO_ICONS: Record<Template['tipo'], string> = {
  email: '✉',
  mensaje_empresa: '🏢',
  mensaje_recruiter: '👤',
};

export interface PostulacionPayload {
  empresa: string;
  oferta_laboral: string;
  categoria_id: number | null;
  idioma: string | null;
  nombre_empleado: string;
  puesto_empleado: string;
  template_ids: number[];
  valores_usados: Record<string, string>;
  resultado_email: string | null;
  resultado_empresa: string | null;
  resultado_recruiter: string | null;
  notas?: string;
  estado?: string;
  link_empresa?: string;
  contacto_empleado?: string;
  favorito?: number;
}

export interface GenerarPayload {
  values: Record<string, string>;
  template_ids: number[];
  categoria_id: number;
  idioma: string;
}

export type TabName = 'postular' | 'historial' | 'templates' | 'config';

export interface EstadoOption {
  value: string;
  label: string;
  color: string;
}

export interface Idioma {
  id: number;
  nombre: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Tag {
  id: number;
  nombre: string;
  color: string;
  created_at: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  link: string;
  post_count: number;
  favorita: number;
  created_at: string;
}

export const ESTADOS: EstadoOption[] = [
  { value: 'solicitado', label: 'Solicitado', color: 'var(--surface-hover)' },
  { value: 'mensajeado', label: 'Mensajeado', color: '#16a34a' },
  { value: 'en_proceso', label: 'En proceso', color: '#2563eb' },
  { value: 'rechazado', label: 'Rechazado', color: '#dc2626' },
  { value: 'pendiente', label: 'Pendiente', color: '#d97706' },
];
