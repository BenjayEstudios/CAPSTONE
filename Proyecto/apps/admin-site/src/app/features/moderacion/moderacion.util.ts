import { EstadoCaso, TipoCaso } from "../../core/models/moderacion.models";

export const ETIQUETA_TIPO: Record<TipoCaso, string> = {
  alta_proveedor: "Alta de proveedor",
  ficha_duplicada: "Ficha duplicada",
  precio_fuera_rango: "Precio fuera de rango",
  reembolso: "Reembolso"
};
export const ETIQUETA_ESTADO: Record<EstadoCaso, string> = {
  abierto: "Abierto",
  resuelto: "Resuelto",
  descartado: "Descartado"
};
export const ETIQUETA_OPERACION: Record<string, string> = {
  abrir_caso: "Caso abierto",
  asignar_caso: "Asignación",
  resolver_caso: "Resuelto",
  descartar_caso: "Descartado"
};
export const MAX_TEXTO = 500;

/** Ruta interna de la entidad relacionada, o null si no hay pantalla. */
export function rutaEntidad(entidad: string, id: number): string[] | null {
  if (entidad === "organizacion") return ["/proveedores", String(id)];
  if (entidad === "producto") return ["/catalogo-maestro", String(id)];
  return null;
}

/** Solo se pueden cerrar o reasignar casos abiertos. */
export function accionesCaso(estado: EstadoCaso): { asignar: boolean; resolver: boolean; descartar: boolean } {
  const a = estado === "abierto";
  return { asignar: a, resolver: a, descartar: a };
}

export function validarTexto(v: string): string | null {
  const t = v.trim();
  if (!t) return "Este campo es obligatorio.";
  if (t.length > MAX_TEXTO) return `Máximo ${MAX_TEXTO} caracteres.`;
  return null;
}

/** Valor del filtro "asignado" para la API a partir del selector (mi | sin_asignar | todos). */
export function asignadoParaApi(valor: string, miId: string | null | undefined): string | undefined {
  if (valor === "mi") return miId ?? undefined;
  if (valor === "sin_asignar") return "sin_asignar";
  return undefined;
}

export function mensajeErrorModeracion(e: any): string {
  const status = e?.status;
  const code = e?.error?.error?.code as string | undefined;
  const msg = e?.error?.error?.message as string | undefined;
  if (status === 403) return "No tienes permiso para realizar esta acción.";
  if (code === "TRANSICION_INVALIDA") return "El caso ya no está abierto. Actualiza la cola para ver su estado actual.";
  if (code === "CASO_NO_ENCONTRADO") return "El caso no existe.";
  if (code === "USUARIO_INVALIDO") return "El usuario elegido no es un usuario interno activo.";
  if (code === "VALIDACION") return `Datos inválidos${msg ? `: ${msg}` : "."}`;
  if (status === 0) return "No hay conexión con el servidor.";
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
