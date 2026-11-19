import type { Producto, ProductoImagen, RegistroAuditoria } from "@cotizapp/domain";

// Campos de la ficha que se auditan. La descripcion (texto largo) solo deja
// constancia de que cambio; las imagenes se resumen en sus URLs. Ninguno es dato sensible.
const CAMPOS = [
  "categoriaId", "sku", "ean", "nombre", "marca", "formato", "contenido", "unidad",
  "precioReferencia", "topeSobreReferenciaPct", "estado"
] as const;

const urls = (imgs: ProductoImagen[]) => imgs.map((i) => i.url);

export function resumenProducto(p: Producto) {
  const r: Record<string, unknown> = {};
  for (const c of CAMPOS) r[c] = p[c];
  return r;
}

export function auditoriaCrearProducto(usuarioId: number | null) {
  return (p: Producto): RegistroAuditoria => ({
    usuarioId,
    entidad: "producto",
    entidadId: p.id,
    accion: "crear",
    datosAntes: null,
    datosDespues: { operacion: "crear_producto", ...resumenProducto(p) }
  });
}

/** Diff solo de los campos que cambian. publicar/archivar se distinguen en `operacion`. */
export function auditoriaEditarProducto(
  usuarioId: number | null,
  antes: Producto,
  cambios: Partial<Omit<Producto, "imagenes">> & { imagenes?: ProductoImagen[] },
  operacionBase = "editar_producto"
): RegistroAuditoria {
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const c of CAMPOS) {
    if (cambios[c] !== undefined && cambios[c] !== antes[c]) {
      a[c] = antes[c];
      d[c] = cambios[c];
    }
  }
  if (cambios.descripcion !== undefined && cambios.descripcion !== antes.descripcion) d.descripcionModificada = true;
  if (cambios.imagenes !== undefined) {
    a.imagenes = urls(antes.imagenes);
    d.imagenes = urls(cambios.imagenes);
  }
  let operacion = operacionBase;
  if (operacionBase === "editar_producto" && d.estado !== undefined) {
    operacion = d.estado === "publicado" ? "publicar_producto" : d.estado === "archivado" ? "archivar_producto" : operacion;
  }
  return {
    usuarioId,
    entidad: "producto",
    entidadId: antes.id,
    accion: "editar",
    datosAntes: a,
    datosDespues: { operacion, ...d }
  };
}
