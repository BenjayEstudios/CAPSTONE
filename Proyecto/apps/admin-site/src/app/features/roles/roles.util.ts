import { NivelPermiso } from "../../core/models/auth.models";
import { RolMatriz } from "../../core/models/roles.models";

export const NIVELES: NivelPermiso[] = ["ninguno", "parcial", "total"];
export const ETIQUETA_NIVEL: Record<NivelPermiso, string> = { ninguno: "Ninguno", parcial: "Parcial", total: "Total" };
export const ROL_ADMIN = "administrador";
export const PERMISO_ADMIN = "cambiar_permisos";

/** Edicion pendiente: rolId -> { codigo: nivel } solo de las celdas modificadas. */
export type Cambios = Record<number, Record<string, NivelPermiso>>;

export function nivelOriginal(rol: RolMatriz, codigo: string): NivelPermiso {
  return rol.permisos[codigo] ?? "ninguno";
}

/** Nivel efectivo de una celda: el editado o, si no hay edicion, el cargado. */
export function nivelActual(rol: RolMatriz, cambios: Cambios, codigo: string): NivelPermiso {
  return cambios[rol.id]?.[codigo] ?? nivelOriginal(rol, codigo);
}

/** Registra una edicion; si vuelve al valor original, la descarta. No muta el argumento. */
export function aplicarCambio(cambios: Cambios, rol: RolMatriz, codigo: string, nivel: NivelPermiso): Cambios {
  const delRol = { ...(cambios[rol.id] ?? {}) };
  if (nivel === nivelOriginal(rol, codigo)) delete delRol[codigo];
  else delRol[codigo] = nivel;
  const resto = { ...cambios };
  if (Object.keys(delRol).length === 0) delete resto[rol.id];
  else resto[rol.id] = delRol;
  return resto;
}

export function estaModificada(cambios: Cambios, rolId: number, codigo: string): boolean {
  return cambios[rolId]?.[codigo] !== undefined;
}

export function totalCambios(cambios: Cambios): number {
  return Object.values(cambios).reduce((n, c) => n + Object.keys(c).length, 0);
}

/** Matriz completa a enviar por cada rol modificado (original + ediciones). */
export function permisosAEnviar(rol: RolMatriz, cambios: Cambios): Record<string, NivelPermiso> {
  return { ...rol.permisos, ...(cambios[rol.id] ?? {}) };
}

export function rolesModificados(roles: RolMatriz[], cambios: Cambios): RolMatriz[] {
  return roles.filter((r) => Object.keys(cambios[r.id] ?? {}).length > 0);
}

/** La celda cambiar_permisos del administrador no se puede editar. */
export function celdaBloqueada(rol: RolMatriz, codigo: string): boolean {
  return rol.codigo === ROL_ADMIN && codigo === PERMISO_ADMIN;
}

const MENSAJES: Record<string, string> = {
  PERMISO_DESCONOCIDO: "Se envió un permiso que no existe en el catálogo.",
  BLOQUEO_ADMIN: "El rol administrador debe conservar el permiso «Cambiar permisos» en total.",
  BLOQUEO_AUTOEDICION: "No puedes quitarte a ti mismo el permiso «Cambiar permisos».",
  ROL_NO_ENCONTRADO: "El rol ya no existe. Recarga la página.",
  FORBIDDEN: "No tienes permiso para realizar esta acción."
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mensajeErrorRoles(e: any): string {
  const code = e?.error?.error?.code as string | undefined;
  const msg = e?.error?.error?.message as string | undefined;
  if (e?.status === 0) return "No hay conexión con el servidor.";
  if (code && MENSAJES[code]) return MENSAJES[code];
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
