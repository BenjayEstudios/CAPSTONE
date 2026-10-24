import { crearProductoSchema, type CategoriaRepository, type ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { armarFicha } from "./obtener-producto.use-case.js";
import { exigirCategoria, validarCoherenciaPrecios, validarPublicable } from "./producto-reglas.js";

// Solo administracion (la ruta aplica requireRol). creadoPor = id del usuario.
export function crearProducto(deps: {
  productoRepository: ProductoRepository;
  categoriaRepository: CategoriaRepository;
}) {
  return async (input: unknown, creadoPor: number | null) => {
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

    const producto = await repo.crear({ ...data, creadoPor });
    return armarFicha(deps, producto);
  };
}
