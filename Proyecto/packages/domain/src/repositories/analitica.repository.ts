import type {
  EmbudoProducto,
  KpisPlataforma,
  RangoFechasAnalitica,
  TerminoSinResultados,
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
  // Panel admin
  kpisPlataforma(rango: RangoFechasAnalitica): Promise<KpisPlataforma>;
  terminosSinResultados(rango: RangoFechasAnalitica, limite?: number): Promise<TerminoSinResultados[]>;
}
