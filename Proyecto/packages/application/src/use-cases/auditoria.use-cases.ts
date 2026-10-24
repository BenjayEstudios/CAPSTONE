import {
  ACCIONES_AUDITORIA,
  listarAuditoriaQuerySchema,
  idParamSchema,
  type AuditoriaRepository,
  type RegistroAuditoriaLog
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

const OCULTO = "[oculto]";
const CLAVE_SENSIBLE = /(hash|clave|password|passwd|contrasena|token|secret|secreto|api[_-]?key)/i;

/** Enmascara recursivamente valores cuyas claves parecen sensibles (defensa en profundidad). */
export function enmascararSensibles(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(enmascararSensibles);
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, CLAVE_SENSIBLE.test(k) ? OCULTO : enmascararSensibles(v)])
    );
  }
  return valor;
}

function operacionDe(datosDespues: unknown): string | undefined {
  if (datosDespues && typeof datosDespues === "object" && !Array.isArray(datosDespues)) {
    const op = (datosDespues as Record<string, unknown>).operacion;
    if (typeof op === "string") return op;
  }
  return undefined;
}

function aResumen(r: RegistroAuditoriaLog) {
  const operacion = operacionDe(r.datosDespues);
  return {
    id: r.id,
    accion: r.accion,
    entidad: r.entidad,
    entidadId: r.entidadId,
    usuario: r.usuario,
    creadoEn: r.creadoEn,
    ...(operacion !== undefined ? { operacion } : {})
  };
}

export function listarAuditoria(deps: { auditoriaRepository: AuditoriaRepository }) {
  return async (input: unknown) => {
    const { desde, hasta, ...resto } = validar(listarAuditoriaQuerySchema, input);
    const hastaExclusivo = hasta ? new Date(new Date(`${hasta}T00:00:00.000Z`).getTime() + 86_400_000) : undefined;
    const f = { ...resto, desde: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined, hastaExclusivo };
    const { items, total } = await deps.auditoriaRepository.listar(f);
    return {
      items: items.map(aResumen),
      pagina: f.pagina,
      tamano: f.tamano,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / f.tamano))
    };
  };
}

export function obtenerRegistroAuditoria(deps: { auditoriaRepository: AuditoriaRepository }) {
  return async (input: unknown) => {
    const { id } = validar(idParamSchema, input);
    const r = await deps.auditoriaRepository.buscarPorId(id);
    if (!r) throw new ErrorAplicacion(404, "REGISTRO_NO_ENCONTRADO", "Registro de auditoria no encontrado");
    return {
      ...aResumen(r),
      datosAntes: enmascararSensibles(r.datosAntes ?? null),
      datosDespues: enmascararSensibles(r.datosDespues ?? null)
    };
  };
}

export function obtenerFiltrosAuditoria(deps: { auditoriaRepository: AuditoriaRepository }) {
  return async () => ({
    acciones: [...ACCIONES_AUDITORIA],
    entidades: await deps.auditoriaRepository.entidadesDistintas(),
    usuarios: await deps.auditoriaRepository.usuariosEnLog()
  });
}
