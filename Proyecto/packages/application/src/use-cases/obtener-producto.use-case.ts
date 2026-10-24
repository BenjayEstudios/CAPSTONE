import type { CategoriaRepository, Producto, ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

// Ficha completa: producto + imagenes + categoria (con su padre) + resumen de ofertas.
export async function armarFicha(
  deps: { productoRepository: ProductoRepository; categoriaRepository: CategoriaRepository },
  producto: Producto
) {
  const categoria = await deps.categoriaRepository.buscarPorId(producto.categoriaId);
  const padre = categoria?.padreId ? await deps.categoriaRepository.buscarPorId(categoria.padreId) : null;
  const ofertas = await deps.productoRepository.resumenOfertas(producto.id);
  return {
    ...producto,
    categoria: categoria
      ? {
          id: categoria.id,
          nombre: categoria.nombre,
          slug: categoria.slug,
          padre: padre ? { id: padre.id, nombre: padre.nombre, slug: padre.slug } : null
        }
      : null,
    proveedoresConOfertaActiva: ofertas.proveedoresConOfertaActiva,
    precioDesde: ofertas.precioDesde
  };
}

export function obtenerProducto(deps: {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}) {
  return async (id: number) => {
    const producto = await deps.productoRepository.buscarPorId(id);
    if (!producto) throw new ErrorAplicacion(404, "PRODUCTO_NO_ENCONTRADO", "El producto no existe");
    return armarFicha(deps, producto);
  };
}
