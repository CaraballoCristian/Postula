export interface Categoria {
  id: number;
  nombre: string;
  created_at: string;
}

export interface Template {
  id: number;
  categoria_id: number;
  idioma: 'es' | 'en';
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
  puesto_oferta: string;
  categoria_id: number | null;
  idioma: 'es' | 'en' | null;
  nombre_reclutador: string;
  puesto_reclutador: string;
  template_ids: number[];
  valores_usados: Record<string, string>;
  resultado_email: string | null;
  resultado_empresa: string | null;
  resultado_recruiter: string | null;
  fecha: string;
  created_at: string;
}

export const TIPOS_MENSAJE: Template['tipo'][] = ['email', 'mensaje_empresa', 'mensaje_recruiter'];

export const TIPO_LABELS: Record<Template['tipo'], string> = {
  email: 'Email',
  mensaje_empresa: 'Mensaje Empresa',
  mensaje_recruiter: 'Mensaje Recruiter',
};

export const TIPO_ICONS: Record<Template['tipo'], string> = {
  email: '✉',
  mensaje_empresa: '🏢',
  mensaje_recruiter: '👤',
};

export interface PostulacionPayload {
  empresa: string;
  puesto_oferta: string;
  categoria_id: number | null;
  idioma: string | null;
  nombre_reclutador: string;
  puesto_reclutador: string;
  template_ids: number[];
  valores_usados: Record<string, string>;
  resultado_email: string | null;
  resultado_empresa: string | null;
  resultado_recruiter: string | null;
}

export interface GenerarPayload {
  values: Record<string, string>;
  template_ids: number[];
  categoria_id: number;
  idioma: string;
}
