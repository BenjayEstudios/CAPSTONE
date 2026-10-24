import {
  aprobarProveedorSchema,
  motivoProveedorSchema,
  type ProveedorEstado,
  type ProveedorRepository,
  type RegistroAuditoria
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { documentosFaltantes, exigirProveedor } from "./proveedor-reglas.js";

type Operacion = "aprobar" | "rechazar" | "suspender";

// Transiciones: en_revision -> activa|suspendida; activa -> suspendida;
// suspendida -> activa solo via aprobar.
const PERMITIDAS: Record<Operacion, ProveedorEstado[]> = {
  aprobar: ["en_revision", "suspendida"],
  rechazar: ["en_revision"],
  suspender: ["en_revision", "activa"]
};
const ESTADO_FINAL: Record<Operacion, ProveedorEstado> = { aprobar: "activa", rechazar: "suspendida", suspender: "suspendida" };
// auditoria_log.accion: el enum no tiene "rechazar"; se usa "editar" con datosDespues.operacion = "rechazar_proveedor".
const ACCION: Record<Operacion, RegistroAuditoria["accion"]> = { aprobar: "aprobar", rechazar: "editar", suspender: "suspender" };

async function ejecutar(
  repo: ProveedorRepository,
  op: Operacion,
  id: number,
  usuarioId: number,
  motivo: string | null,
  comisionPct?: number
) {
  const p = await exigirProveedor(repo, id);
  if (!PERMITIDAS[op].includes(p.estado)) {
    throw new ErrorAplicacion(409, "TRANSICION_INVALIDA", `No se puede ${op} un proveedor en estado ${p.estado}`);
  }
  if (op === "aprobar") {
    const faltantes = documentosFaltantes(await repo.listarDocumentos(id));
    if (faltantes.length > 0) {
      throw new ErrorAplicacion(409, "REQUISITOS_INCOMPLETOS", `Faltan documentos aprobados: ${faltantes.join(", ")}`);
    }
  }
  const final = ESTADO_FINAL[op];
  const actualizado = await repo.cambiarEstado(id, final, comisionPct, {
    usuarioId,
    entidad: "organizacion",
    entidadId: id,
    accion: ACCION[op],
    datosAntes: { estado: p.estado, comisionPct: p.comisionPct },
    datosDespues: {
      operacion: `${op}_proveedor`,
      estado: final,
      comisionPct: comisionPct ?? p.comisionPct,
      motivo
    }
  });
  return { id: actualizado.id, estado: actualizado.estado, comisionPct: actualizado.comisionPct };
}

export function aprobarProveedor(deps: { proveedorRepository: ProveedorRepository }) {
  return async (id: number, input: unknown, usuarioId: number) => {
    const dto = validar(aprobarProveedorSchema, input ?? {});
    return ejecutar(deps.proveedorRepository, "aprobar", id, usuarioId, null, dto.comisionPct);
  };
}

export function rechazarProveedor(deps: { proveedorRepository: ProveedorRepository }) {
  return async (id: number, input: unknown, usuarioId: number) =>
    ejecutar(deps.proveedorRepository, "rechazar", id, usuarioId, validar(motivoProveedorSchema, input).motivo);
}

export function suspenderProveedor(deps: { proveedorRepository: ProveedorRepository }) {
  return async (id: number, input: unknown, usuarioId: number) =>
    ejecutar(deps.proveedorRepository, "suspender", id, usuarioId, validar(motivoProveedorSchema, input).motivo);
}
