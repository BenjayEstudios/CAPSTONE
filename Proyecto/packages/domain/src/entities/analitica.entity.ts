// Resultados de las consultas de analitica de los paneles (KAN-143). Son
// lecturas agregadas, no entidades persistidas. Montos en CLP.

// Intervalo [desde, hasta): desde inclusive, hasta exclusivo. Las fechas se
// comparan en UTC, que es como se guardan los datetime.
export interface RangoFechas {
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
  vistas: number;
  clicks: number;
  conversiones: number;
  tasaClick: number | null;
  tasaConversion: number | null;
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
