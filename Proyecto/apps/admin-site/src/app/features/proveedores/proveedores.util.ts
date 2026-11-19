import { HttpErrorResponse } from "@angular/common/http";
import {
  EstadoProveedor, ProveedorFicha, ProveedorListadoItem, ResultadoEstado, TipoDocumento
} from "../../core/models/proveedores.models";

export const ETIQUETA_DOC: Record<TipoDocumento, string> = {
  carpeta_tributaria: "Carpeta tributaria",
  resolucion_sanitaria: "Resolución sanitaria",
  vigencia: "Vigencia"
};

export const ETIQUETA_ESTADO: Record<EstadoProveedor, string> = {
  en_revision: "En revisión",
  activa: "Activa",
  suspendida: "Suspendida"
};

export const etiquetaDoc = (t: string) => ETIQUETA_DOC[t as TipoDocumento] ?? t;

// comisionPct puede llegar como numero, string decimal o null.
export function normalizarComision(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function formatearComision(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v}%`;
}

export const normalizarItem = (i: ProveedorListadoItem): ProveedorListadoItem => ({
  ...i, comisionPct: normalizarComision(i.comisionPct)
});
export const normalizarFicha = (f: ProveedorFicha): ProveedorFicha => ({
  ...f, comisionPct: normalizarComision(f.comisionPct)
});
export const normalizarResultado = (r: ResultadoEstado): ResultadoEstado => ({
  ...r, comisionPct: normalizarComision(r.comisionPct)
});

export interface AccionesPermitidas {
  aprobar: boolean;
  rechazar: boolean;
  suspender: boolean;
}

// Acciones del proveedor segun estado (suspendida solo puede volver a aprobarse).
export function accionesPermitidas(estado: EstadoProveedor): AccionesPermitidas {
  return {
    aprobar: estado !== "activa",
    rechazar: estado === "en_revision",
    suspender: estado === "en_revision" || estado === "activa"
  };
}

// Valida comision opcional: "" => null (sin comision).
export function validarComision(texto: string): { valor: number | null; error: string | null } {
  const t = texto.trim();
  if (!t) return { valor: null, error: null };
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return { valor: null, error: "La comisión debe ser un número entre 0 y 100." };
  return { valor: n, error: null };
}

export function validarMotivo(texto: string): string | null {
  const t = texto.trim();
  if (t.length < 1) return "El motivo es obligatorio.";
  if (t.length > 240) return "El motivo no puede superar los 240 caracteres.";
  return null;
}

const MENSAJES: Record<string, string> = {
  TRANSICION_INVALIDA: "Esa acción no es válida para el estado actual del proveedor.",
  PROVEEDOR_NO_ENCONTRADO: "El proveedor no existe o fue eliminado.",
  DOCUMENTO_NO_ENCONTRADO: "El documento no existe o no pertenece a este proveedor.",
  VALIDACION: "Los datos enviados no son válidos. Revisa los campos."
};

export function mensajeErrorProveedor(err: unknown): string {
  const e = err as HttpErrorResponse;
  const status = e?.status;
  const code = e?.error?.error?.code as string | undefined;
  const msg = e?.error?.error?.message as string | undefined;
  if (status === 403) return "No tienes permiso para realizar esta acción.";
  if (code === "REQUISITOS_INCOMPLETOS") {
    return `No se puede aprobar: requisitos incompletos${msg ? ` (${msg})` : ""}.`;
  }
  if (code && MENSAJES[code]) return code === "VALIDACION" && msg ? `${MENSAJES[code]} ${msg}` : MENSAJES[code];
  if (status === 0) return "No hay conexión con el servidor.";
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
