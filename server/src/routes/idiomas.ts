import crudFactory from './crudFactory';

const router = crudFactory({
  table: 'idiomas',
  conflict: 'Ya existe ese idioma',
  notFound: 'Idioma no encontrado',
  required: 'El nombre es requerido',
  createError: 'Error al crear idioma',
  updateError: 'Error al actualizar idioma',
  defaultKey: 'default_idioma',
  defaultOf: 'nombre',
});

export default router;