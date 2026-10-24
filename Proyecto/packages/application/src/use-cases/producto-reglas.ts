import type { CategoriaRepository, Producto, ProductoImagen } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

type CamposPublicables = Pick<
  Producto,
  "nombre" | "categoriaId" | "precioReferencia" | "topeSobreReferenciaPct" | "imagenes"
>;

// Coherencia precio/tope: el tope es un % sobre la referencia, no tiene
// sentido sin precio de referencia.
export function validarCoherenciaPrecios(p: Pick<Producto, "precioReferencia" | "topeSobreReferenciaPct">) {
  if (p.topeSobreReferenciaPct !== null && p.precioReferencia === null) {
    throw new ErrorAplicacion(
      400,
      "PRECIO_INCOHERENTE",
      "No se puede definir un tope sobre la referencia sin precio de referencia"
    );
  }
}

// Minimos para publicar (KAN-116/117): nombre, categoria, precio de
// referencia y una (y solo una) imagen principal.
export function validarPublicable(p: CamposPublicables) {
  const faltantes: string[] = [];
  if (!p.nombre?.trim()) faltantes.push("nombre");
  if (!p.categoriaId) faltantes.push("categoria");
  if (p.precioReferencia === null || p.precioReferencia <= 0) faltantes.push("precio de referencia");
  if (p.imagenes.filter((i) => i.esPrincipal).length !== 1) faltantes.push("imagen principal");
  if (faltantes.length > 0) {
    throw new ErrorAplicacion(400, "PUBLICACION_INCOMPLETA", `No se puede publicar: falta ${faltantes.join(", ")}`);
  }
  validarCoherenciaPrecios(p);
}

export function validarImagenes(imagenes: ProductoImagen[]) {
  if (imagenes.length === 0) return;
  const principales = imagenes.filter((i) => i.esPrincipal).length;
  if (principales === 0) {
    throw new ErrorAplicacion(400, "IMAGEN_PRINCIPAL_REQUERIDA", "Debe haber exactamente una imagen principal");
  }
  if (principales > 1) {
    throw new ErrorAplicacion(400, "IMAGEN_PRINCIPAL_MULTIPLE", "Solo puede haber una imagen principal");
  }
}

export async function exigirCategoria(repo: CategoriaRepository, categoriaId: number) {
  const c = await repo.buscarPorId(categoriaId);
  if (!c) throw new ErrorAplicacion(400, "CATEGORIA_NO_EXISTE", "La categoria indicada no existe");
  return c;
}
