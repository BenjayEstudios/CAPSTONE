import '../domain/categoria.dart';
import '../domain/producto.dart';

// Mapeo JSON (API_CONTRACT.md) -> entidades del catálogo. Se llama dentro
// de parsear(), así que un campo con otro tipo termina en ServerFailure.

Categoria categoriaDesdeJson(Map<String, dynamic> j) => Categoria(
      id: j['id'] as int,
      padreId: j['padreId'] as int?,
      nombre: j['nombre'] as String,
      slug: j['slug'] as String,
      orden: j['orden'] as int?,
    );

ProductoResumen productoResumenDesdeJson(Map<String, dynamic> j) => ProductoResumen(
      id: j['id'] as int,
      sku: j['sku'] as String,
      nombre: j['nombre'] as String,
      marca: j['marca'] as String?,
      formato: j['formato'] as String?,
      contenido: (j['contenido'] as num?)?.toDouble(),
      unidad: Unidad.desdeCodigo(j['unidad'] as String),
      categoriaId: j['categoriaId'] as int,
      imagenUrl: j['imagenUrl'] as String?,
      precioDesde: j['precioDesde'] as int,
      precioHasta: j['precioHasta'] as int,
      cantidadOfertas: j['ofertas'] as int,
      plazoMinHoras: j['plazoMinHoras'] as int?,
    );

PaginaProductos paginaDesdeJson(Map<String, dynamic> j) => PaginaProductos(
      items: [for (final i in j['items'] as List) productoResumenDesdeJson(Map<String, dynamic>.from(i as Map))],
      total: j['total'] as int,
    );

ProductoDetalle productoDetalleDesdeJson(Map<String, dynamic> j) {
  final categoria = j['categoria'] as Map<String, dynamic>;
  final padre = categoria['padre'] as Map<String, dynamic>?;
  return ProductoDetalle(
    id: j['id'] as int,
    sku: j['sku'] as String,
    nombre: j['nombre'] as String,
    marca: j['marca'] as String?,
    formato: j['formato'] as String?,
    contenido: (j['contenido'] as num?)?.toDouble(),
    unidad: Unidad.desdeCodigo(j['unidad'] as String),
    descripcion: j['descripcion'] as String?,
    imagenUrl: j['imagenUrl'] as String?,
    categoria: CategoriaProducto(
      id: categoria['id'] as int,
      nombre: categoria['nombre'] as String,
      padreNombre: padre?['nombre'] as String?,
    ),
    precioReferencia: j['precioReferencia'] as int?,
    ofertas: [for (final o in j['ofertas'] as List) _ofertaDesdeJson(Map<String, dynamic>.from(o as Map))],
  );
}

OfertaProducto _ofertaDesdeJson(Map<String, dynamic> j) {
  final p = j['proveedor'] as Map<String, dynamic>;
  final c = p['calificacion'] as Map<String, dynamic>;
  return OfertaProducto(
    id: j['id'] as int,
    precioUnitario: j['precioUnitario'] as int,
    unidadesPorCaja: j['unidadesPorCaja'] as int?,
    cajasDisponibles: j['cajasDisponibles'] as int?,
    minimoCompra: j['minimoCompra'] as int?,
    plazoHoras: j['plazoHoras'] as int?,
    modalidad: ModalidadEntrega.desdeCodigo(j['modalidadEntrega'] as String),
    notasCliente: j['notasCliente'] as String?,
    proveedor: ProveedorOferta(
      id: p['id'] as int,
      nombre: p['nombre'] as String,
      entregasATiempoPct: (p['entregasATiempoPct'] as num?)?.toDouble(),
      despachoGratisDesde: p['despachoGratisDesde'] as int?,
      costoDespacho: p['costoDespacho'] as int?,
      calificacion: ResumenCalificacion(
        promedio: (c['promedio'] as num?)?.toDouble(),
        cantidad: c['cantidad'] as int,
      ),
    ),
  );
}
