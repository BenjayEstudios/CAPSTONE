// Resultados de las consultas de analitica de los paneles (KAN-143). Son
// lecturas agregadas, no entidades persistidas. Montos en CLP.

// Intervalo [desde, hasta): desde inclusive, hasta exclusivo. Las fechas se
// comparan en UTC, que es como se guardan los datetime.
export interface RangoFechasAnalitica {
  desde: Date;
  hasta: Date;
}

// Ventas de un proveedor en una semana (lunes a domingo, UTC). Semanas sin
// ventas vienen en 0 para que el grafico no tenga huecos.
export interface VentaSemanal {
  // Lunes de la semana, 'AAAA-MM-DD'.
  semana: string;
  envios: number;
  // Suma de los subtotales de producto (sin despacho).
  ventas: number;
  despacho: number;
  comision: number;
  // ventas + despacho - comision: lo que recibe el proveedor.
  neto: number;
}

export interface VentaProducto {
  productoId: number;
  nombre: string;
  unidades: number;
  ventas: number;
}

// Embudo vista -> click -> conversion de un producto, visto por un
// proveedor: vistas de la ficha (compartida entre proveedores) y clicks en
// SU oferta. Tasas en [0, 1], null si el denominador es 0.
export interface EmbudoProducto {
  productoId: number;
  nombre: string;
  /** Aditivo (KAN-107): la oferta del proveedor, su formato, su estado y las cajas vendidas en el rango. */
  ofertaId: number;
  formato: string | null;
  estadoOferta: "borrador" | "publicada" | "pausada";
  cajasVendidas: number;
  vistas: number;
  clicks: number;
  conversiones: number;
  tasaClick: number | null;
  tasaConversion: number | null;
}

/** Stock de una oferta publicada frente al del inicio del mes (KAN-107). */
export interface StockDelMes {
  ofertaId: number;
  productoId: number;
  nombre: string;
  formato: string | null;
  cajasDisponibles: number;
  /**
   * Cajas al inicio del mes: el ultimo cambio de stock antes del mes en
   * oferta_precio_historial; si la oferta es del mes o no tiene historial,
   * sus cajas iniciales.
   */
  cajasInicioMes: number | null;
}

/**
 * Compradores que vieron un producto que el proveedor ofrece y en el rango se
 * lo compraron a otro proveedor, por la comuna donde recibieron (KAN-107).
 */
export interface PotencialesComuna {
  comunaId: number;
  comuna: string;
  region: string;
  clientes: number;
  /** El proveedor despacha a esa comuna (por comuna o por region). */
  cubre: boolean;
}

export interface KpisPlataforma {
  ordenes: number;
  // GMV: total pagado por los clientes (productos + despacho).
  gmv: number;
  ticketPromedio: number | null;
  // Ingreso de Cotizapp.
  comisiones: number;
  proveedoresConVentas: number;
  clientesConCompras: number;
  vistas: number;
  clicks: number;
  conversiones: number;
  tasaConversion: number | null;
  busquedas: number;
  busquedasSinResultados: number;
}

// Huecos del catalogo: lo que se busca y no existe.
export interface TerminoSinResultados {
  termino: string;
  veces: number;
}

// Oferta publicada con pocas cajas (bloque "Requiere atencion", KAN-101/137).
export interface StockBajo {
  ofertaId: number;
  productoId: number;
  producto: string;
  cajasDisponibles: number;
  cajasIniciales: number | null;
}

// Lo pendiente de un proveedor para su panel (KAN-101) y las alertas de la
// app (KAN-137). Montos en CLP.
export interface PendientesProveedor {
  stockBajo: StockBajo[];
  // Neto (subtotal + despacho - comision) de envios entregados sin liquidar.
  entregadoSinLiquidar: number;
  // Suma de monto_neto de liquidaciones pendientes de pago.
  liquidacionesPendientes: number;
  // Envios por despachar de ordenes pagadas.
  enviosPorDespachar: number;
  ofertasPublicadas: number;
  ofertasBorrador: number;
}
