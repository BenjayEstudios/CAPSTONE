import {
  listarProductosQuerySchema,
  type CategoriaRepository,
  type ProductoRepository
} from "@cotizapp/domain";
import { validar } from "../validacion.js";

// Listado admin paginado. Filtrar por una categoria padre incluye sus subcategorias.
export function listarProductos(deps: {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}) {
  return async (input: unknown) => {
    const f = validar(listarProductosQuerySchema, input);
    let categoriaIds: number[] | undefined;
    if (f.categoriaId !== undefined) {
      const todas = await deps.categoriaRepository.listar();
      categoriaIds = [f.categoriaId, ...todas.filter((c) => c.padreId === f.categoriaId).map((c) => c.id)];
    }
    const { items, total } = await deps.productoRepository.listar({
      estado: f.estado,
      categoriaIds,
      q: f.q,
      pagina: f.pagina,
      tamano: f.tamano
    });
    return {
      items,
      pagina: f.pagina,
      tamano: f.tamano,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / f.tamano))
    };
  };
}
