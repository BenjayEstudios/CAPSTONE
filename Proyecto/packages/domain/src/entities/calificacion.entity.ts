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
