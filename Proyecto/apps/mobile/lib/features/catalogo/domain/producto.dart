// Unidad de medida del contenido (enum unidad de la tabla producto): permite
// comparar precio por kg / L / unidad entre formatos distintos.
enum Unidad {
  kg('kg'),
  litro('L'),
  unidad('un');

  const Unidad(this.abreviatura);
  final String abreviatura;

  static Unidad desdeCodigo(String codigo) => switch (codigo) {
        'kg' => Unidad.kg,
        'L' => Unidad.litro,
        _ => Unidad.unidad,
      };
}

// Fila del listado / búsqueda: la ficha más el rango de precios de sus
// ofertas publicadas.
class ProductoResumen {
  const ProductoResumen({
    required this.id,
    required this.sku,
    required this.nombre,
    required this.marca,
    required this.formato,
    required this.contenido,
    required this.unidad,
    required this.categoriaId,
    required this.imagenUrl,
    required this.precioDesde,
    required this.precioHasta,
    required this.cantidadOfertas,
    required this.plazoMinHoras,
  });

  final int id;
  final String sku;
  final String nombre;
  final String? marca;
  final String? formato;
  final double? contenido;
  final Unidad unidad;
  final int categoriaId;
  final String? imagenUrl;
  final int precioDesde;
  final int precioHasta;
  final int cantidadOfertas;
  final int? plazoMinHoras;

  // Lo que se ahorra eligiendo la oferta más barata en vez de la más cara.
  int get diferencia => precioHasta - precioDesde;

  // Precio más bajo por kg / L / unidad (null si falta el contenido).
  int? get precioDesdePorUnidad => precioPorUnidad(precioDesde, contenido);
}

class PaginaProductos {
  const PaginaProductos({required this.items, required this.total});

  final List<ProductoResumen> items;
  final int total;
}

class ResumenCalificacion {
  const ResumenCalificacion({required this.promedio, required this.cantidad});

  // null si el proveedor aún no tiene calificaciones.
  final double? promedio;
  final int cantidad;
}

class ProveedorOferta {
  const ProveedorOferta({
    required this.id,
    required this.nombre,
    required this.calificacion,
    required this.entregasATiempoPct,
    required this.despachoGratisDesde,
    required this.costoDespacho,
  });

  final int id;
  final String nombre;
  final ResumenCalificacion calificacion;
  final double? entregasATiempoPct;
  final int? despachoGratisDesde;
  final int? costoDespacho;
}

enum ModalidadEntrega {
  despacho,
  retiro,
  ambos;

  static ModalidadEntrega desdeCodigo(String codigo) => switch (codigo) {
        'retiro' => ModalidadEntrega.retiro,
        'ambos' => ModalidadEntrega.ambos,
        _ => ModalidadEntrega.despacho,
      };

  String get etiqueta => switch (this) {
        ModalidadEntrega.despacho => 'Despacho',
        ModalidadEntrega.retiro => 'Retiro en bodega',
        ModalidadEntrega.ambos => 'Despacho o retiro',
      };
}

// Una fila del comparador: lo que vende un proveedor para este producto.
class OfertaProducto {
  const OfertaProducto({
    required this.id,
    required this.precioUnitario,
    required this.unidadesPorCaja,
    required this.cajasDisponibles,
    required this.minimoCompra,
    required this.plazoHoras,
    required this.modalidad,
    required this.notasCliente,
    required this.proveedor,
  });

  final int id;
  final int precioUnitario;
  final int? unidadesPorCaja;
  final int? cajasDisponibles;
  final int? minimoCompra;
  final int? plazoHoras;
  final ModalidadEntrega modalidad;
  final String? notasCliente;
  final ProveedorOferta proveedor;
}

class CategoriaProducto {
  const CategoriaProducto({required this.id, required this.nombre, this.padreNombre});

  final int id;
  final String nombre;
  final String? padreNombre;
}

// Ficha completa con sus ofertas publicadas (GET /productos/:id).
class ProductoDetalle {
  const ProductoDetalle({
    required this.id,
    required this.sku,
    required this.nombre,
    required this.marca,
    required this.formato,
    required this.contenido,
    required this.unidad,
    required this.descripcion,
    required this.imagenUrl,
    required this.categoria,
    required this.precioReferencia,
    required this.ofertas,
  });

  final int id;
  final String sku;
  final String nombre;
  final String? marca;
  final String? formato;
  final double? contenido;
  final Unidad unidad;
  final String? descripcion;
  final String? imagenUrl;
  final CategoriaProducto categoria;
  final int? precioReferencia;
  final List<OfertaProducto> ofertas;

  int? get precioMinimo =>
      ofertas.isEmpty ? null : ofertas.map((o) => o.precioUnitario).reduce((a, b) => a < b ? a : b);
  int? get precioMaximo =>
      ofertas.isEmpty ? null : ofertas.map((o) => o.precioUnitario).reduce((a, b) => a > b ? a : b);
}

// 12490 por un bidón de 5 L -> 2498 ($/L).
int? precioPorUnidad(int precio, double? contenido) {
  if (contenido == null || contenido <= 0) return null;
  return (precio / contenido).round();
}
