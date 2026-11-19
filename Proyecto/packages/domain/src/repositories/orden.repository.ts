import type { Orden, OrdenEstado } from "../entities/orden.entity.js";
import type { OrdenEnvio, OrdenEnvioEstado } from "../entities/orden-envio.entity.js";
import type { OrdenLinea } from "../entities/orden-linea.entity.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

export type AlcanceOrdenes =
  | { tipo: "todas" }
  | { tipo: "cliente"; usuarioId: number }
  | { tipo: "proveedor"; proveedorId: number };

export interface EnvioConLineas extends OrdenEnvio {
  proveedorNombre: string;
  lineas: OrdenLinea[];
}

export interface DireccionEntregaInfo {
  calle: string;
  numero: string | null;
  complemento: string | null;
  referencia: string | null;
  comunaNombre: string;
  regionNombre: string;
}

export interface OrdenCompleta {
  orden: Orden;
  /** Solo los envios dentro del alcance (proveedor: los suyos). */
  envios: EnvioConLineas[];
  clienteNombre: string;
  organizacionNombre: string;
  direccionEntrega: DireccionEntregaInfo | null;
}

export interface FiltrosOrdenes {
  alcance: AlcanceOrdenes;
  /** Estado de la orden (cliente/todas) o del envio (proveedor). */
  estado?: string;
  pagina: number;
  tamano: number;
}

export interface EntregadoProveedor {
  /** Inicio del plazo: orden.pagado_en, o creada_en si aun no hay fecha de pago. */
  inicio: Date;
  fin: Date;
  plazoHoras: number | null;
}

export interface ContextoCambioEnvio {
  envio: OrdenEnvio;
  orden: Orden;
  /** Todos los envios de la orden (incluido el que cambia). */
  hermanos: OrdenEnvio[];
  /** Envios ya entregados del proveedor (sin el actual), para recalcular entregas_a_tiempo_pct. */
  entregadosProveedor: () => Promise<EntregadoProveedor[]>;
}

export interface PlanCambioEnvio {
  estadoEnvio: OrdenEnvioEstado;
  estadoOrden: OrdenEstado;
  /** null = no tocar organizacion.entregas_a_tiempo_pct. */
  entregasATiempoPct: number | null;
  auditoria: RegistroAuditoria[];
}

export interface OrdenRepository {
  listar(f: FiltrosOrdenes): Promise<{ items: OrdenCompleta[]; total: number }>;
  /** null si no existe o queda fuera del alcance. */
  buscarPorId(id: number, alcance: AlcanceOrdenes): Promise<OrdenCompleta | null>;
  /** Envio (sin alcance) para validar propiedad antes de operar; null si no existe. */
  buscarEnvio(id: number): Promise<OrdenEnvio | null>;
  /**
   * Transaccion: bloquea el envio y la orden (FOR UPDATE), ejecuta `planificar` y persiste
   * estado del envio, estado de la orden, entregas_a_tiempo_pct del proveedor y auditoria.
   */
  cambiarEstadoEnvio(envioId: number, planificar: (ctx: ContextoCambioEnvio) => Promise<PlanCambioEnvio>): Promise<void>;
}
