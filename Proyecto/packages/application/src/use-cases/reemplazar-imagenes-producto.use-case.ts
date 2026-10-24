import { reemplazarImagenesSchema, type ProductoImagen, type ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { validarImagenes } from "./producto-reglas.js";

// Reemplaza la lista de imagenes (solo metadatos; no hay subida de archivos
// hasta decidir el storage). Si el producto esta publicado debe quedar con
// una imagen principal.
export function reemplazarImagenesProducto(deps: {
  productoRepository: ProductoRepository;
  ahora?: () => Date;
}) {
  const ahora = deps.ahora ?? (() => new Date());
  return async (id: number, input: unknown, usuarioId: number | null) => {
    const { imagenes } = validar(reemplazarImagenesSchema, input);

    const producto = await deps.productoRepository.buscarPorId(id);
    if (!producto) throw new ErrorAplicacion(404, "PRODUCTO_NO_ENCONTRADO", "El producto no existe");

    const previas = new Map(producto.imagenes.map((i) => [i.url, i]));
    const ts = ahora().toISOString();
    const nuevas: ProductoImagen[] = imagenes
      .map((img, idx) => ({ img, idx }))
      .sort((a, b) => (a.img.orden ?? a.idx) - (b.img.orden ?? b.idx) || a.idx - b.idx)
      .map(({ img }, pos) => {
        const previa = previas.get(img.url);
        const nueva: ProductoImagen = {
          url: img.url,
          textoAlt: img.textoAlt ?? null,
          orden: pos,
          esPrincipal: img.esPrincipal,
          subidaPor: previa ? previa.subidaPor : usuarioId,
          subidaEn: previa ? previa.subidaEn : ts
        };
        if (img.ancho !== undefined) nueva.ancho = img.ancho;
        if (img.alto !== undefined) nueva.alto = img.alto;
        return nueva;
      });

    validarImagenes(nuevas);
    if (producto.estado === "publicado" && nuevas.length === 0) {
      throw new ErrorAplicacion(400, "PUBLICACION_INCOMPLETA", "Un producto publicado necesita una imagen principal");
    }

    const actualizado = await deps.productoRepository.actualizar(id, { imagenes: nuevas });
    return actualizado.imagenes;
  };
}
