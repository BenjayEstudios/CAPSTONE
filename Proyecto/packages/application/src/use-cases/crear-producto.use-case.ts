import { crearProductoSchema, type CategoriaRepository, type ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { armarFicha } from "./obtener-producto.use-case.js";
import { auditoriaCrearProducto } from "./producto-auditoria.js";
import { exigirCategoria, validarCoherenciaPrecios, validarPublicable } from "./producto-reglas.js";

interface Deps {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}

// Todas las reglas de un producto nuevo, sin escribir nada: la usan crearProducto
// y la importacion masiva (que ademas puede simular).
export async function validarNuevoProducto(deps: Deps, input: unknown) {
  const repo = deps.productoRepository;
  const data = validar(crearProductoSchema, input);

  if (await repo.buscarPorSku(data.sku)) {
    throw new ErrorAplicacion(409, "SKU_DUPLICADO", `Ya existe un producto con el SKU ${data.sku}`);
  }
  if (data.ean && (await repo.buscarPorEan(data.ean))) {
    throw new ErrorAplicacion(409, "EAN_DUPLICADO", `Ya existe un producto con el EAN ${data.ean}`);
  }
  await exigirCategoria(deps.categoriaRepository, data.categoriaId);

  const precioReferencia = data.precioReferencia ?? null;
  const topeSobreReferenciaPct = data.topeSobreReferenciaPct ?? null;
  validarCoherenciaPrecios({ precioReferencia, topeSobreReferenciaPct });
  // Un producto nuevo no tiene imagenes: publicar directo falla por la imagen principal.
  if (data.estado === "publicado") {
    validarPublicable({
      nombre: data.nombre,
      categoriaId: data.categoriaId,
      precioReferencia,
      topeSobreReferenciaPct,
      imagenes: []
    });
  }
  return data;
}

// Solo administracion (la ruta aplica requireRol). creadoPor = id del usuario.
export function crearProducto(deps: Deps) {
  return async (input: unknown, creadoPor: number | null) => {
    const data = await validarNuevoProducto(deps, input);
    const producto = await deps.productoRepository.crear({ ...data, creadoPor }, auditoriaCrearProducto(creadoPor));
    return armarFicha(deps, producto);
  };
}
