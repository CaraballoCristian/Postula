import crudFactory from './crudFactory';

const router = crudFactory({
  table: 'tags',
  conflict: 'Ya existe ese tag',
  notFound: 'Tag no encontrado',
  required: 'El nombre es requerido',
  createError: 'Error al crear tag',
  updateError: 'Error al actualizar tag',
  orderBy: 'id ASC',
  slug: true,
  extraCols: ['color'],
  requireNombreOnUpdate: false,
  notFoundOnDelete: false,
  propagateOnRename: { table: 'postulaciones', column: 'estado' },
  reassignOnDelete: { table: 'postulaciones', column: 'estado' },
});

export default router;