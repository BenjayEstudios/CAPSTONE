import {
  TIPOS_DOCUMENTO_REQUERIDOS,
  type ProveedorDocumento,
  type ProveedorDocumentoTipo,
  type ProveedorRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

export async function exigirProveedor(repo: ProveedorRepository, id: number) {
  const p = await repo.buscarPorId(id);
  if (!p) throw new ErrorAplicacion(404, "PROVEEDOR_NO_ENCONTRADO", "Proveedor no encontrado");
  return p;
}

// Tipos requeridos cuyo documento mas reciente (id mayor) no existe o no esta aprobado.
export function documentosFaltantes(docs: ProveedorDocumento[]): ProveedorDocumentoTipo[] {
  return TIPOS_DOCUMENTO_REQUERIDOS.filter((tipo) => {
    const delTipo = docs.filter((d) => d.tipo === tipo);
    if (delTipo.length === 0) return true;
    const ultimo = delTipo.reduce((a, b) => (b.id > a.id ? b : a));
    return ultimo.revisionEstado !== "aprobado";
  });
}
