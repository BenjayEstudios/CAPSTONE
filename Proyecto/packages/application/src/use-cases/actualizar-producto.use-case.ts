import { actualizarProductoSchema, type CategoriaRepository, type ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { armarFicha } from "./obtener-producto.use-case.js";
import { auditoriaEditarProducto } from "./producto-auditoria.js";
import { exigirCategoria, validarCoherenciaPrecios, validarPublicable } from "./producto-reglas.js";

interface Deps {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}

// Todas las reglas de una edicion, sin escribir nada: la usan actualizarProducto
// y la importacion masiva (que ademas puede simular). Devuelve lo ya guardado y
// los cambios validados.
export async function validarCambiosProducto(deps: Deps, id: number, input: unknown) {
  const repo = deps.productoRepository;
  const cambios = validar(actualizarProductoSchema, input);

  const actual = await repo.buscarPorId(id);
  if (!actual) throw new ErrorAplicacion(404, "PRODUCTO_NO_ENCONTRADO", "El producto no existe");

  if (cambios.sku !== undefined && cambios.sku !== actual.sku) {
    const otro = await repo.buscarPorSku(cambios.sku);
    if (otro && otro.id !== id) {
      throw new ErrorAplicacion(409, "SKU_DUPLICADO", `Ya existe un producto con el SKU ${cambios.sku}`);
    }
  }
  if (cambios.ean && cambios.ean !== actual.ean) {
    const otro = await repo.buscarPorEan(cambios.ean);
    if (otro && otro.id !== id) {
      throw new ErrorAplicacion(409, "EAN_DUPLICADO", `Ya existe un producto con el EAN ${cambios.ean}`);
    }
  }
  if (cambios.categoriaId !== undefined && cambios.categoriaId !== actual.categoriaId) {
    await exigirCategoria(deps.categoriaRepository, cambios.categoriaId);
  }

  // Se valida el estado resultante (lo ya guardado + los cambios).
  const resultante = { ...actual, ...cambios };
  validarCoherenciaPrecios(resultante);
  if (resultante.estado === "publicado") validarPublicable(resultante);

  return { actual, cambios };
}

export function actualizarProducto(deps: Deps) {
  return async (id: number, input: unknown, usuarioId: number | null = null) => {
    const { actual, cambios } = await validarCambiosProducto(deps, id, input);
    const actualizado = await deps.productoRepository.actualizar(
      id,
      cambios,
      auditoriaEditarProducto(usuarioId, actual, cambios)
    );
    return armarFicha(deps, actualizado);
  };
}
