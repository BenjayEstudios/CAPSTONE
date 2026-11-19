import '../../catalogo/domain/producto.dart';

// Ítem tal como lo guarda y devuelve GET/PUT /carro (detalleItems en
// carro.use-cases.ts). cantidad en cajas; precioVisto es el precio que vio
// el cliente al agregarlo (si cambió, el checkout lo rechaza con
// PRECIO_CAMBIO).
class ItemCarro {
  const ItemCarro({
    required this.ofertaId,
    required this.cantidad,
    required this.precioVisto,
    this.precioActual,
    this.productoId,
    this.nombreProducto,
    this.formato,
    this.proveedorId,
    this.disponible = true,
    this.cajasDisponibles,
  });

  final int ofertaId;
  final int cantidad;
  final int precioVisto;
  final int? precioActual;
  final int? productoId;
  final String? nombreProducto;
  final String? formato;
  final int? proveedorId;
  final bool disponible;
  final int? cajasDisponibles;

  bool get precioCambio => precioActual != null && precioActual != precioVisto;
  int get precio => precioActual ?? precioVisto;
  int get total => precio * cantidad;
}

// Línea del carro con lo que hace falta para mostrarla: los datos de la
// oferta y del producto salen de la ficha del catálogo.
class LineaCarro {
  const LineaCarro({required this.item, this.oferta, this.producto});

  final ItemCarro item;
  final OfertaProducto? oferta;
  final ProductoDetalle? producto;

  String get nombre => item.nombreProducto ?? producto?.nombre ?? 'Producto ${item.productoId ?? ''}';

  // El backend exige cantidad × unidadesPorCaja >= minimoCompra
  // (planificarOrden): de ahí la mínima en cajas.
  int get cantidadMinima {
    final porCaja = oferta?.unidadesPorCaja ?? 1;
    final minimo = oferta?.minimoCompra ?? 1;
    return (minimo / (porCaja <= 0 ? 1 : porCaja)).ceil().clamp(1, 1 << 30);
  }

  int? get cantidadMaxima => item.cajasDisponibles ?? oferta?.cajasDisponibles;

  // Pide más de lo que hay: el checkout lo rechazaría con SIN_STOCK.
  bool get excedeStock => cantidadMaxima != null && item.cantidad > cantidadMaxima!;

  // Lo que se ahorra frente al proveedor más caro del mismo producto.
  int get ahorro {
    final max = producto?.precioMaximo;
    if (max == null || max <= item.precio) return 0;
    return (max - item.precio) * item.cantidad;
  }
}

// Un proveedor dentro del carro: será un envío de la orden.
class GrupoCarro {
  const GrupoCarro({required this.proveedorId, required this.proveedor, required this.lineas});

  final int proveedorId;
  final ProveedorOferta? proveedor;
  final List<LineaCarro> lineas;

  String get nombre => proveedor?.nombre ?? 'Proveedor $proveedorId';
  int get subtotal => lineas.fold(0, (s, l) => s + l.item.total);

  // Plazo del envío = el mayor de sus ofertas (planificarOrden).
  int? get plazoHoras {
    final plazos = lineas.map((l) => l.oferta?.plazoHoras).whereType<int>();
    return plazos.isEmpty ? null : plazos.reduce((a, b) => a > b ? a : b);
  }

  // Estimado con la tarifa de despacho del proveedor; el monto final lo
  // calcula el backend al confirmar según la dirección (cobertura).
  int get despachoEstimado {
    final p = proveedor;
    if (p == null || p.costoDespacho == null) return 0;
    if (p.despachoGratisDesde != null && subtotal >= p.despachoGratisDesde!) return 0;
    return p.costoDespacho!;
  }

  // Cuánto falta para el despacho gratis (null si ya aplica o no hay umbral).
  int? get faltaParaGratis {
    final umbral = proveedor?.despachoGratisDesde;
    if (umbral == null || subtotal >= umbral) return null;
    return umbral - subtotal;
  }
}

class CarroDetallado {
  const CarroDetallado({required this.grupos});

  static const vacio = CarroDetallado(grupos: []);

  final List<GrupoCarro> grupos;

  List<LineaCarro> get lineas => [for (final g in grupos) ...g.lineas];
  List<ItemCarro> get items => [for (final l in lineas) l.item];
  bool get estaVacio => lineas.isEmpty;
  int get cantidadLineas => lineas.length;
  int get unidades => items.fold(0, (s, i) => s + i.cantidad);
  int get subtotal => grupos.fold(0, (s, g) => s + g.subtotal);
  int get despachos => grupos.fold(0, (s, g) => s + g.despachoEstimado);
  int get ahorro => lineas.fold(0, (s, l) => s + l.ahorro);
  int get total => subtotal + despachos;
  bool get hayPreciosCambiados => items.any((i) => i.precioCambio);
  bool get hayNoDisponibles => items.any((i) => !i.disponible);
  bool get haySinStock => lineas.any((l) => l.excedeStock);

  // Lo que el backend rechazaría al confirmar: mejor resolverlo en el carro.
  bool get listoParaPagar => !estaVacio && !hayPreciosCambiados && !hayNoDisponibles && !haySinStock;
}
