import type { Carro, CarroItem } from "../entities/carro.entity.js";
import type { OrdenEnvioModalidad } from "../entities/orden-envio.entity.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

export interface OfertaCarro {
  id: number;
  productoId: number;
  proveedorId: number;
  productoNombre: string;
  formato: string | null;
  productoPublicado: boolean;
  ofertaPublicada: boolean;
  precioUnitario: number;
  /** null = sin control de stock. */
  cajasDisponibles: number | null;
  unidadesPorCaja: number | null;
  minimoCompra: number | null;
  plazoHoras: number | null;
  modalidadEntrega: "despacho" | "retiro" | "ambos";
}

export interface CoberturaProveedor {
  comunaId: number | null;
  regionCodigo: string;
  costoDespacho: number;
  plazoHoras: number | null;
}

export interface ProveedorCheckout {
  id: number;
  razonSocial: string;
  activo: boolean;
  /** null = comision aun no decidida por el negocio -> se trata como 0. */
  comisionPct: number | null;
  despachoGratisDesde: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  plazoEstandarHoras: number | null;
  coberturas: CoberturaProveedor[];
}

export interface PuntoRetiroCheckout {
  id: number;
  proveedorId: number;
  activo: boolean;
}

/** Foto consistente (con las filas de oferta bloqueadas FOR UPDATE) sobre la que se planifica la orden. */
export interface ContextoCheckout {
  carro: Carro | null;
  ofertas: OfertaCarro[];
  proveedores: ProveedorCheckout[];
  puntosRetiro: PuntoRetiroCheckout[];
  /** Comuna de la direccion elegida (null si no se indico o no existe). */
  comunaDestino: { id: number; regionCodigo: string } | null;
}

export interface LineaPlan {
  ofertaId: number;
  productoId: number;
  nombreProducto: string;
  formato: string | null;
  precioUnitario: number;
  cantidad: number;
  totalLinea: number;
}

export interface EnvioPlan {
  proveedorId: number;
  modalidad: OrdenEnvioModalidad;
  puntoRetiroId: number | null;
  plazoHoras: number | null;
  costoDespacho: number;
  subtotal: number;
  comisionPct: number;
  comisionMonto: number;
  lineas: LineaPlan[];
}

export interface PlanOrden {
  subtotal: number;
  costoDespachoTotal: number;
  comisionTotal: number;
  total: number;
  requiereFactura: boolean;
  envios: EnvioPlan[];
  /** Descuentos de stock (solo ofertas con control de stock). */
  stock: Array<{ ofertaId: number; cajasAnteriores: number; cajasNuevas: number }>;
}

export interface EntradaCheckout {
  direccionId?: number;
  direccionNueva?: { comunaId: number; calle: string; numero?: string; complemento?: string; referencia?: string };
}

export interface OrdenCreada {
  ordenId: number;
  codigo: string;
}

/** Direccion guardada de la organizacion (GET /carro/opciones-entrega). */
export interface DireccionGuardada {
  id: number;
  calle: string;
  numero: string | null;
  complemento: string | null;
  referencia: string | null;
  comunaId: number;
  comuna: string;
  region: string;
}

/** Punto de retiro activo de un proveedor. */
export interface PuntoRetiroOpcion {
  id: number;
  proveedorId: number;
  nombre: string;
  horario: string | null;
  direccion: string;
}

export interface OpcionesEntrega {
  direcciones: DireccionGuardada[];
  puntosRetiro: PuntoRetiroOpcion[];
}

export interface CarroRepository {
  /**
   * Direcciones de la organizacion (la suya y las usadas en sus ordenes
   * anteriores) y puntos de retiro activos de los proveedores indicados.
   */
  opcionesEntrega(organizacionId: number, proveedorIds: number[]): Promise<OpcionesEntrega>;
  obtenerAbierto(usuarioId: number): Promise<Carro | null>;
  /** Crea el carro abierto si no existe y reemplaza sus items. */
  guardarItems(usuarioId: number, items: CarroItem[]): Promise<Carro>;
  ofertasPorIds(ids: number[]): Promise<OfertaCarro[]>;
  /**
   * Transaccion unica: bloquea las ofertas del carro (FOR UPDATE), arma el contexto, ejecuta `planificar`
   * (puro; lanza ErrorAplicacion para abortar) y persiste orden, envios, lineas, descuento de stock,
   * historial de stock (motivo venta), carro convertido y auditoria.
   */
  confirmar(
    usuarioId: number,
    organizacionId: number,
    entrada: EntradaCheckout,
    planificar: (ctx: ContextoCheckout) => PlanOrden,
    auditoria: (ordenId: number, plan: PlanOrden) => RegistroAuditoria
  ): Promise<OrdenCreada>;
}
