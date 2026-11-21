// Panel del distribuidor: ventas (KAN-133) y visitas/conversión (KAN-134).
// Montos en CLP; fechas en UTC como las agrupa el backend.

class TotalesVentas {
  const TotalesVentas(
      {required this.envios, required this.ventas, required this.despacho, required this.comision, required this.neto});

  final int envios;
  // Subtotal de productos (sin despacho).
  final int ventas;
  final int despacho;
  final int comision;
  // ventas + despacho - comisión: lo que recibe el proveedor.
  final int neto;

  int? get ticketPromedio => envios == 0 ? null : (ventas / envios).round();
}

class VentaSemanal {
  const VentaSemanal({required this.semana, required this.envios, required this.ventas, required this.neto});

  // Lunes de la semana.
  final DateTime semana;
  final int envios;
  final int ventas;
  final int neto;
}

class VentaProducto {
  const VentaProducto({required this.productoId, required this.nombre, required this.unidades, required this.ventas});

  final int productoId;
  final String nombre;
  final int unidades;
  final int ventas;
}

class ResumenVentas {
  const ResumenVentas({required this.totales, required this.semanas, required this.productos});

  final TotalesVentas totales;
  final List<VentaSemanal> semanas;
  final List<VentaProducto> productos;
}

// KPIs de un mes contra el mes anterior (mismo tramo si el mes está en curso).
class ComparacionMensual {
  const ComparacionMensual({required this.mes, required this.actual, required this.anterior, required this.corte});

  final DateTime mes;
  final TotalesVentas actual;
  final TotalesVentas anterior;
  // Último día contado del mes (hoy, si es el mes en curso).
  final DateTime corte;

  static double? variacion(num actual, num? anterior) =>
      anterior == null || anterior == 0 ? null : (actual - anterior) / anterior;
}

class VisitasDia {
  const VisitasDia({required this.fecha, required this.vistas, required this.clicks});

  final DateTime fecha;
  final int vistas;
  final int clicks;
}

class VisitasProducto {
  const VisitasProducto({
    required this.ofertaId,
    required this.productoId,
    required this.producto,
    required this.vistas,
    required this.clicks,
    required this.conversion,
  });

  final int ofertaId;
  final int productoId;
  final String producto;
  final int vistas;
  final int clicks;
  // clicks / vistas, entre 0 y 1.
  final double conversion;
}

// Interés por comuna: vistas de los productos del proveedor desde esa comuna.
class DemandaComuna {
  const DemandaComuna({required this.comuna, required this.vistas, required this.clicks, required this.cubre});

  final String comuna;
  final int vistas;
  final int clicks;
  // El proveedor despacha a esa comuna (proveedor_cobertura).
  final bool cubre;
}

class Visitas {
  const Visitas({
    required this.vistas,
    required this.clicks,
    required this.conversion,
    required this.porDia,
    required this.porProducto,
    required this.porComuna,
  });

  final int vistas;
  final int clicks;
  final double conversion;
  final List<VisitasDia> porDia;
  final List<VisitasProducto> porProducto;
  // null si la API todavía no manda el campo aditivo porComuna.
  final List<DemandaComuna>? porComuna;
}
