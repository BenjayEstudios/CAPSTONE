// Órdenes tal como las presenta GET /ordenes y GET /ordenes/:id (presentar()
// en packages/application/src/use-cases/ordenes.use-cases.ts). La misma
// forma sirve a los dos perfiles: el cliente ve sus órdenes completas sin
// comisiones; el proveedor ve solo su envío y sus montos.

enum EstadoOrden {
  pendientePago('pendiente_pago', 'Pendiente de pago'),
  pagada('pagada', 'Pagada'),
  enPreparacion('en_preparacion', 'En preparación'),
  despachada('despachada', 'En camino'),
  entregada('entregada', 'Entregada'),
  reembolsada('reembolsada', 'Reembolsada');

  const EstadoOrden(this.codigo, this.etiqueta);
  final String codigo;
  final String etiqueta;

  static EstadoOrden desdeCodigo(String c) => values.firstWhere((e) => e.codigo == c, orElse: () => pendientePago);
}

enum EstadoEnvio {
  porDespachar('por_despachar', 'Por despachar'),
  enPreparacion('en_preparacion', 'En preparación'),
  listoRetiro('listo_retiro', 'Listo para retiro'),
  despachado('despachado', 'Despachado'),
  entregado('entregado', 'Entregado'),
  cancelado('cancelado', 'Cancelado');

  const EstadoEnvio(this.codigo, this.etiqueta);
  final String codigo;
  final String etiqueta;

  static EstadoEnvio desdeCodigo(String c) => values.firstWhere((e) => e.codigo == c, orElse: () => porDespachar);

  bool get vigente => this != entregado && this != cancelado;

  // Siguiente paso (sin cancelar) de la máquina de estados del backend
  // (transicionesPermitidas): despacho por_despachar -> en_preparacion ->
  // despachado -> entregado; retiro pasa por listo_retiro.
  EstadoEnvio? siguiente({required bool esRetiro}) => switch (this) {
        porDespachar => enPreparacion,
        enPreparacion => esRetiro ? listoRetiro : despachado,
        despachado || listoRetiro => entregado,
        _ => null,
      };

  // Pasos que ve el cliente en el seguimiento del envío.
  static List<EstadoEnvio> pasos({required bool esRetiro}) =>
      [porDespachar, enPreparacion, esRetiro ? listoRetiro : despachado, entregado];
}

enum MedioPago {
  tarjeta('tarjeta', 'Tarjeta de crédito o débito'),
  transferencia('transferencia', 'Transferencia bancaria'),
  lineaCredito('linea_credito', 'Línea de crédito (empresas, 30 días)');

  const MedioPago(this.codigo, this.etiqueta);
  final String codigo;
  final String etiqueta;

  static MedioPago? desdeCodigo(String? c) => values.where((e) => e.codigo == c).firstOrNull;
}

class LineaOrden {
  const LineaOrden({
    required this.ofertaId,
    required this.productoId,
    required this.nombreProducto,
    required this.formato,
    required this.precioUnitario,
    required this.cantidad,
    required this.totalLinea,
  });

  final int ofertaId;
  final int productoId;
  final String nombreProducto;
  final String? formato;
  final int precioUnitario;
  final int cantidad;
  final int totalLinea;
}

class PuntoRetiroOrden {
  const PuntoRetiroOrden({required this.nombre, required this.direccion, this.horario});

  final String nombre;
  final String direccion;
  final String? horario;
}

class CalificacionEnvio {
  const CalificacionEnvio({required this.puntaje, this.comentario});

  final int puntaje;
  final String? comentario;
}

class EnvioOrden {
  const EnvioOrden({
    required this.id,
    required this.proveedorId,
    required this.proveedorNombre,
    required this.esRetiro,
    required this.plazoHoras,
    required this.costoDespacho,
    required this.subtotal,
    required this.montoEnvio,
    required this.montoALiquidar,
    required this.estado,
    required this.actualizadoEn,
    this.lineas = const [],
    this.puntoRetiro,
    this.calificacion,
    this.calificacionConocida = false,
  });

  final int id;
  final int proveedorId;
  final String proveedorNombre;
  final bool esRetiro;
  final int? plazoHoras;
  final int costoDespacho;
  final int subtotal;
  final int montoEnvio;
  // Lo que recibe el proveedor (null para el cliente).
  final int? montoALiquidar;
  final EstadoEnvio estado;
  final DateTime actualizadoEn;
  final List<LineaOrden> lineas;
  final PuntoRetiroOrden? puntoRetiro;
  final CalificacionEnvio? calificacion;
  // El campo calificacion es aditivo (API_CONTRACT.md): si la API todavía no
  // lo manda, no se sabe si ya se calificó y el botón igual se ofrece.
  final bool calificacionConocida;

  int get unidades => lineas.fold(0, (s, l) => s + l.cantidad);
  bool get calificable => estado == EstadoEnvio.entregado && calificacion == null;
}

class DireccionOrden {
  const DireccionOrden({required this.texto, required this.comuna, this.referencia});

  final String texto;
  final String comuna;
  final String? referencia;
}

class Orden {
  const Orden({
    required this.id,
    required this.codigo,
    required this.estado,
    required this.estadoPago,
    required this.creadaEn,
    required this.pagadoEn,
    required this.requiereFactura,
    required this.medioPago,
    required this.comuna,
    required this.clienteNombre,
    required this.clienteOrganizacion,
    required this.subtotal,
    required this.costoDespachoTotal,
    required this.total,
    required this.montoALiquidarTotal,
    required this.envios,
    this.direccion,
  });

  final int id;
  final String codigo;
  final EstadoOrden estado;
  // autorizado | pagado | fallido | reembolsado
  final String estadoPago;
  final DateTime creadaEn;
  final DateTime? pagadoEn;
  final bool requiereFactura;
  final MedioPago? medioPago;
  final String? comuna;
  final String? clienteNombre;
  final String? clienteOrganizacion;
  final int subtotal;
  final int costoDespachoTotal;
  final int total;
  final int? montoALiquidarTotal;
  final List<EnvioOrden> envios;
  final DireccionOrden? direccion;

  bool get pagoPendiente => estado == EstadoOrden.pendientePago;
  bool get pagoRechazado => estadoPago == 'fallido';
}

class PaginaOrdenes {
  const PaginaOrdenes({required this.items, required this.total});

  final List<Orden> items;
  final int total;
}
