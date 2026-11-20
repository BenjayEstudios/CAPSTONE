import { EnvioOrden, OrdenDetalle } from "../../core/models/checkout.models";

// Estados de la orden y del envio en palabras del comprador (KAN-98), y los
// pasos del seguimiento. La maquina de estados del envio esta en el backend
// (transicionesPermitidas en ordenes.use-cases.ts):
//   despacho: por_despachar -> en_preparacion -> despachado -> entregado
//   retiro:   por_despachar -> en_preparacion -> listo_retiro -> entregado
// y se puede cancelar desde los dos primeros.

export type EstadoOrden = OrdenDetalle["estado"];

const ORDEN: Record<EstadoOrden, string> = {
  pendiente_pago: "Pendiente de pago",
  pagada: "Pagada",
  en_preparacion: "En preparación",
  despachada: "Despachada",
  entregada: "Entregada",
  reembolsada: "Reembolsada"
};

/** Estado de la orden; si el ultimo intento de pago fallo, lo dice. */
export function estadoOrden(o: Pick<OrdenDetalle, "estado" | "estadoPago">): string {
  if (o.estado === "pendiente_pago" && o.estadoPago === "fallido") return "Pago no completado";
  return ORDEN[o.estado] ?? o.estado;
}

/** Tono del estado para la insignia: pendiente (acento 2), en curso, terminada. */
export function tonoOrden(o: Pick<OrdenDetalle, "estado">): "pendiente" | "en-curso" | "terminada" {
  if (o.estado === "pendiente_pago") return "pendiente";
  if (o.estado === "entregada" || o.estado === "reembolsada") return "terminada";
  return "en-curso";
}

const ENVIO: Record<string, string> = {
  por_despachar: "Por despachar",
  en_preparacion: "En preparación",
  listo_retiro: "Listo para retiro",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado"
};

export function estadoEnvio(estado: string): string {
  return ENVIO[estado] ?? estado;
}

export interface PasoSeguimiento {
  estado: string;
  etiqueta: string;
  hecho: boolean;
  actual: boolean;
}

/** Pasos del envio segun su modalidad, marcando los hechos y el actual. Cancelado: sin pasos. */
export function pasosEnvio(e: Pick<EnvioOrden, "modalidad" | "estado">): PasoSeguimiento[] {
  if (e.estado === "cancelado") return [];
  const orden = ["por_despachar", "en_preparacion", e.modalidad === "retiro" ? "listo_retiro" : "despachado", "entregado"];
  const i = Math.max(0, orden.indexOf(e.estado));
  return orden.map((estado, k) => ({ estado, etiqueta: estadoEnvio(estado), hecho: k <= i, actual: k === i }));
}

/** Filtros de "Mis pedidos" (?estado=). */
export const FILTROS_PEDIDOS: Array<{ estado: EstadoOrden | null; etiqueta: string }> = [
  { estado: null, etiqueta: "Todos" },
  { estado: "pendiente_pago", etiqueta: "Pendientes de pago" },
  { estado: "pagada", etiqueta: "Pagados" },
  { estado: "en_preparacion", etiqueta: "En preparación" },
  { estado: "despachada", etiqueta: "Despachados" },
  { estado: "entregada", etiqueta: "Entregados" }
];
