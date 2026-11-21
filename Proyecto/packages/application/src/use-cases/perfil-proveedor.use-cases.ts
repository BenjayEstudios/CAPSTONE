import {
  actualizarPerfilProveedorSchema,
  type CambiosPerfilProveedor,
  type ComunaRepository,
  type PerfilProveedor,
  type ProveedorRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

// Perfil de empresa del proveedor (KAN-108): los datos de su ficha publica y
// de sus documentos tributarios, y el estado de su cuenta. La organizacion
// sale del token (nunca se pide por id).

export interface DepsPerfilProveedor {
  proveedorRepository: ProveedorRepository;
  comunaRepository: ComunaRepository;
}

/** "00-002-48213-02" -> "…3-02": la cuenta en la auditoria, sin el numero completo. */
export function enmascararCuenta(cuenta: string | null | undefined): string | null {
  if (!cuenta) return cuenta ?? null;
  return `…${cuenta.slice(-4)}`;
}

async function cargar(deps: DepsPerfilProveedor, proveedorId: number): Promise<PerfilProveedor> {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
  const p = await deps.proveedorRepository.perfil(proveedorId);
  if (!p) throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
  return p;
}

/** GET /proveedor/perfil */
export function miPerfilProveedor(deps: DepsPerfilProveedor) {
  return async (proveedorId: number) => cargar(deps, proveedorId);
}

const CAMPOS_ORGANIZACION = [
  "nombreFantasia",
  "giro",
  "emailContacto",
  "telefono",
  "plazoEstandarHoras",
  "plazoFueraRegionHoras",
  "horaCorte",
  "despachoGratisDesde",
  "ofreceDespacho",
  "ofreceRetiro",
  "banco",
  "cuentaBancaria"
] as const;

/**
 * PATCH /proveedor/perfil. Reglas:
 * - Debe ofrecer despacho o retiro (al menos uno): 409 SIN_MODALIDAD.
 * - Ofrecer retiro exige una bodega (la que tiene o la que manda): 409 RETIRO_SIN_BODEGA.
 * - Las comunas tienen que existir: 400 VALIDACION.
 * Devuelve el perfil actualizado. La auditoria guarda solo lo que cambio, con
 * la cuenta bancaria enmascarada.
 */
export function actualizarMiPerfilProveedor(deps: DepsPerfilProveedor) {
  return async (usuarioId: number, proveedorId: number, input: unknown): Promise<PerfilProveedor> => {
    const actual = await cargar(deps, proveedorId);
    const dto = validar(actualizarPerfilProveedorSchema, input);

    const despacho = dto.ofreceDespacho ?? actual.ofreceDespacho;
    const retiro = dto.ofreceRetiro ?? actual.ofreceRetiro;
    if (!despacho && !retiro) throw new ErrorAplicacion(409, "SIN_MODALIDAD", "Tienes que ofrecer despacho, retiro o ambos");
    if (retiro && !actual.bodega && !dto.bodega) {
      throw new ErrorAplicacion(409, "RETIRO_SIN_BODEGA", "Para ofrecer retiro indica la dirección y el horario de tu bodega");
    }
    const comunas = [dto.direccion?.comunaId, dto.bodega?.comunaId].filter((c): c is number => c !== undefined);
    if (comunas.length) {
      const existentes = new Set((await deps.comunaRepository.listar()).map((c) => c.id));
      if (comunas.some((c) => !existentes.has(c))) throw new ErrorAplicacion(400, "VALIDACION", "comunaId: la comuna no existe");
    }

    const cambios: CambiosPerfilProveedor = {};
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};
    for (const campo of CAMPOS_ORGANIZACION) {
      const nuevo = dto[campo];
      if (nuevo === undefined || nuevo === actual[campo]) continue;
      (cambios as Record<string, unknown>)[campo] = nuevo;
      antes[campo] = campo === "cuentaBancaria" ? enmascararCuenta(actual.cuentaBancaria) : actual[campo];
      despues[campo] = campo === "cuentaBancaria" ? enmascararCuenta(nuevo as string | null) : nuevo;
    }
    const sinNulos = (d: { numero?: string | null; complemento?: string | null }) => ({ numero: d.numero ?? null, complemento: d.complemento ?? null });
    if (dto.direccion) {
      cambios.direccion = { calle: dto.direccion.calle, comunaId: dto.direccion.comunaId, ...sinNulos(dto.direccion) };
      antes.direccion = actual.direccion;
      despues.direccion = cambios.direccion;
    }
    if (dto.bodega) {
      cambios.bodega = { nombre: dto.bodega.nombre, horario: dto.bodega.horario ?? null, calle: dto.bodega.calle, comunaId: dto.bodega.comunaId, ...sinNulos(dto.bodega) };
      antes.bodega = actual.bodega;
      despues.bodega = cambios.bodega;
    }
    if (Object.keys(cambios).length === 0) return actual;

    await deps.proveedorRepository.actualizarPerfil(proveedorId, cambios, {
      usuarioId,
      entidad: "organizacion",
      entidadId: proveedorId,
      accion: "editar",
      datosAntes: antes,
      datosDespues: { operacion: "editar_perfil_proveedor", ...despues }
    });
    return cargar(deps, proveedorId);
  };
}
