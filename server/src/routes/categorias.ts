import crudFactory from './crudFactory';

const router = crudFactory({
  table: 'categorias',
  conflict: 'Ya existe una categoría con ese nombre',
  notFound: 'Categoría no encontrada',
  required: 'El nombre es requerido',
  createError: 'Error al crear categoría',
  updateError: 'Error al actualizar categoría',
  defaultKey: 'default_categoria_id',
  reassignOnDelete: { table: 'postulaciones', column: 'categoria_id' },
  reassignRefKind: 'id',
  reassignErrors: {
    destNotFound: 'Categoría destino no encontrada',
    same: 'No se puede reasignar a la misma categoría',
  },
});

export default router;