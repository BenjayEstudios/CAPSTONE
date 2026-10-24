import {
  actualizarPermisosSchema,
  CATALOGO_PERMISOS,
  CODIGOS_PERMISO,
  type NivelPermiso,
  type PermisosRol,
  type RolRepository,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

export const ROL_ADMINISTRADOR = "administrador";
const PERMISO_ADMIN = "cambiar_permisos";

/** Matriz completa: todos los codigos del catalogo, los ausentes como "ninguno". */
export function normalizarPermisos(p: Record<string, NivelPermiso | undefined> | null | undefined): PermisosRol {
  const out: PermisosRol = {};
  for (const c of CODIGOS_PERMISO) out[c] = p?.[c] ?? "ninguno";
  return out;
}

export function listarRoles(deps: { rolRepository: RolRepository }) {
  return async () => {
    const roles = await deps.rolRepository.listar();
    return {
      roles: roles.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion,
        esSistema: r.esSistema,
        permisos: normalizarPermisos(r.permisos),
        usuariosAfectados: r.usuariosAfectados,
        permisosActualizadoPor:
          r.permisosActualizadoPor === null ? null : { id: r.permisosActualizadoPor, nombre: r.permisosActualizadoPorNombre ?? "" },
        permisosActualizadoEn: r.permisosActualizadoEn
      })),
      catalogo: CATALOGO_PERMISOS.map((p) => ({ ...p }))
    };
  };
}

export function actualizarPermisosRol(deps: { rolRepository: RolRepository; usuarioRepository: UsuarioRepository }) {
  return async (id: number, input: unknown, usuarioId: number) => {
    const rol = await deps.rolRepository.buscarPorId(id);
    if (!rol) throw new ErrorAplicacion(404, "ROL_NO_ENCONTRADO", "El rol no existe");

    const { permisos } = validar(actualizarPermisosSchema, input);
    const desconocidos = Object.keys(permisos).filter((c) => !CODIGOS_PERMISO.includes(c));
    if (desconocidos.length > 0) {
      throw new ErrorAplicacion(400, "PERMISO_DESCONOCIDO", `Permisos desconocidos: ${desconocidos.join(", ")}`);
    }

    const antes = normalizarPermisos(rol.permisos);
    const despues = normalizarPermisos(permisos);

    if (rol.codigo === ROL_ADMINISTRADOR && despues[PERMISO_ADMIN] !== "total") {
      throw new ErrorAplicacion(409, "BLOQUEO_ADMIN", "El rol administrador debe conservar cambiar_permisos en total");
    }
    const actual = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (actual && actual.rol.id === rol.id && despues[PERMISO_ADMIN] !== "total") {
      throw new ErrorAplicacion(409, "BLOQUEO_AUTOEDICION", "No puedes quitarte a ti mismo el permiso cambiar_permisos");
    }

    const cambios = CODIGOS_PERMISO.filter((c) => antes[c] !== despues[c]);
    if (cambios.length === 0) return { id: rol.id, permisos: antes, cambiado: false };

    const datosAntes: PermisosRol = {};
    const datosDespues: PermisosRol = {};
    for (const c of cambios) {
      datosAntes[c] = antes[c];
      datosDespues[c] = despues[c];
    }
    const actualizado = await deps.rolRepository.actualizarPermisos(id, despues, usuarioId, {
      usuarioId,
      entidad: "rol",
      entidadId: id,
      accion: "editar",
      datosAntes,
      datosDespues
    });
    return {
      id: actualizado.id,
      permisos: normalizarPermisos(actualizado.permisos),
      permisosActualizadoPor: actualizado.permisosActualizadoPor,
      permisosActualizadoEn: actualizado.permisosActualizadoEn,
      cambiado: true
    };
  };
}
