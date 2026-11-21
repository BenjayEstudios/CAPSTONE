import type {
  EmbudoProducto,
  KpisPlataforma,
  PotencialesComuna,
  StockDelMes,
  RangoFechasAnalitica,
  TerminoSinResultados,
  PendientesProveedor,
  VentaProducto,
  VentaSemanal
} from "../entities/analitica.entity.js";

// Puerto de las consultas de analitica de los paneles (KAN-143). Cuenta como
// venta un envio no cancelado de una orden pagada (estado_pago = 'pagado'),
// fechado por orden.creada_en. Implementacion: DrizzleAnaliticaRepository en
// @cotizapp/infrastructure.
export interface AnaliticaRepository {
  // Panel proveedor
  ventasPorSemana(proveedorId: number, rango: RangoFechasAnalitica): Promise<VentaSemanal[]>;
  ventasPorProducto(proveedorId: number, rango: RangoFechasAnalitica, limite?: number): Promise<VentaProducto[]>;
  embudoPorProducto(proveedorId: number, rango: RangoFechasAnalitica): Promise<EmbudoProducto[]>;
  /** Ofertas publicadas con su stock y el del inicio del mes (KAN-107). */
  stockDelMes(proveedorId: number, inicioMes: Date): Promise<StockDelMes[]>;
  /** Clientes potenciales por comuna (KAN-107). */
  potencialesPorComuna(proveedorId: number, rango: RangoFechasAnalitica): Promise<PotencialesComuna[]>;
  /** Stock bajo (cajas <= umbral), por cobrar, envios por despachar y ofertas, de un proveedor (KAN-101). */
  pendientesProveedor(proveedorId: number, umbralStock: number): Promise<PendientesProveedor>;
  // Panel admin
  kpisPlataforma(rango: RangoFechasAnalitica): Promise<KpisPlataforma>;
  terminosSinResultados(rango: RangoFechasAnalitica, limite?: number): Promise<TerminoSinResultados[]>;
}
