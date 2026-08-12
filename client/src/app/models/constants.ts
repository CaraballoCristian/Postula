import { Template } from './interfaces';

export const DEFAULT_ESTADO = 'solicitado';

export const OTRAS = '__otras__';

export const TIPOS_TR: Record<Template['tipo'], `tipo.${Template['tipo']}`> = {
  email: 'tipo.email',
  mensaje_empresa: 'tipo.mensaje_empresa',
  mensaje_recruiter: 'tipo.mensaje_recruiter',
};