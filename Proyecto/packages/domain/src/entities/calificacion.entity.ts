// Entidad de dominio: calificacion que el cliente deja a un proveedor por
// un envio entregado (una por orden_envio). Ver DataBase/dbDiagram.sql ->
// Table calificacion.
export interface Calificacion {
  id: number;
  ordenEnvioId: number;
  usuarioId: number;
  puntaje: number;
  comentario: string | null;
  creadaEn: Date;
}

// Lo que muestra el comparador junto a cada proveedor. promedio es null si
// el proveedor aun no tiene calificaciones (cantidad = 0).
export interface ResumenCalificacionProveedor {
  proveedorId: number;
  promedio: number | null;
  cantidad: number;
}

// Por que no se pudo registrar una calificacion. Las dos primeras se
// devuelven como 409/422 en la API; puntaje_invalido normalmente lo frena
// antes el schema de zod.
export type CalificacionErrorCodigo = "envio_no_calificable" | "ya_calificado" | "puntaje_invalido";

export class CalificacionError extends Error {
  constructor(readonly codigo: CalificacionErrorCodigo) {
    super(`No se pudo registrar la calificacion: ${codigo}`);
    this.name = "CalificacionError";
  }
}

// KAN-200. Calificacion recibida por un proveedor, tal como la ve en su panel
// y en la app movil: con el folio de la orden y la organizacion compradora.
export interface CalificacionRecibida {
  id: number;
  ordenEnvioId: number;
  ordenCodigo: string;
  /** Nombre de la organizacion compradora (no del usuario que califico). */
  cliente: string;
  puntaje: number;
  comentario: string | null;
  creadaEn: Date;
}

/** Cuantas calificaciones recibio el proveedor por cada puntaje (1 a 5). */
export type DistribucionCalificaciones = Record<"1" | "2" | "3" | "4" | "5", number>;

export interface ResumenCalificacionesRecibidas {
  /** null si no tiene calificaciones. */
  promedio: number | null;
  cantidad: number;
  distribucion: DistribucionCalificaciones;
}
