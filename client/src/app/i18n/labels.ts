export type Lang = 'es' | 'en';

// Solo traducen los valores DEFAULT del seed; lo creado por el usuario se muestra tal cual.
export const DEFAULT_TAG_LABELS: Record<string, Record<Lang, string>> = {
  solicitado: { es: 'Solicitado', en: 'Applied' },
  mensajeado: { es: 'Mensajeado', en: 'Messaged' },
  en_proceso: { es: 'En proceso', en: 'In progress' },
  rechazado: { es: 'Rechazado', en: 'Rejected' },
  pendiente: { es: 'Pendiente', en: 'Pending' },
};

export const DEFAULT_CAT_LABELS: Record<string, Record<Lang, string>> = {
  Tech: { es: 'Tecnología', en: 'Tech' },
  Management: { es: 'Gestión', en: 'Management' },
};