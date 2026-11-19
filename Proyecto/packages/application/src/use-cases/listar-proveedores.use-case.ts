import { listarProveedoresQuerySchema, type ProveedorRepository } from "@cotizapp/domain";
import { validar } from "../validacion.js";

export function listarProveedores(deps: { proveedorRepository: ProveedorRepository }) {
  return async (input: unknown) => {
    const f = validar(listarProveedoresQuerySchema, input);
    const { items, total } = await deps.proveedorRepository.listar(f);
    return { items, pagina: f.pagina, tamano: f.tamano, total, totalPaginas: Math.max(1, Math.ceil(total / f.tamano)) };
  };
}
