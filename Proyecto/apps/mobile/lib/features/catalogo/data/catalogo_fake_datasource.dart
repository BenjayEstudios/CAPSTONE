import '../../../core/error/failure.dart';
import '../../../core/fake/seed.dart';
import 'catalogo_datasource.dart';

// Reemplaza GET /productos y GET /productos/:id (y /categorias, para que la
// app funcione completa sin backend) con los datos del seed. Aplica las
// mismas reglas que API_CONTRACT.md le pide al backend: solo ofertas
// "publicada" de proveedores "activa", filtros y orden.
class CatalogoFakeDatasource implements CatalogoDatasource {
  const CatalogoFakeDatasource({this.latencia = const Duration(milliseconds: 300)});

  final Duration latencia;

  @override
  Future<List<Map<String, dynamic>>> categorias() async {
    await Future<void>.delayed(latencia);
    return [
      for (final c in seedCategorias)
        {'id': c.id, 'padreId': c.padreId, 'nombre': c.nombre, 'slug': c.slug, 'orden': c.orden, 'estado': 'activa'},
    ];
  }

  @override
  Future<Map<String, dynamic>> productos(Map<String, dynamic> query) async {
    await Future<void>.delayed(latencia);

    final texto = _normalizar((query['q'] as String?) ?? '');
    final categoriaId = query['categoriaId'] as int?;
    final plazoMax = query['plazoMaxHoras'] as int?;
    final maxPorCaja = query['maxUnidadesPorCaja'] as int?;
    final orden = (query['orden'] as String?) ?? 'relevancia';
    final porPagina = (query['porPagina'] as int?) ?? 20;
    final pagina = (query['pagina'] as int?) ?? 1;

    final items = <Map<String, dynamic>>[];
    for (final p in seedProductos) {
      if (categoriaId != null && p.categoriaId != categoriaId && _padreDe(p.categoriaId) != categoriaId) continue;
      if (texto.isNotEmpty && !_normalizar('${p.nombre} ${p.marca ?? ''}').contains(texto)) continue;

      // Los filtros de plazo y caja se aplican por oferta: el producto
      // aparece si al menos una oferta los cumple, y el rango de precios se
      // calcula solo con esas.
      final ofertas = _ofertasVisibles(p.id)
          .where((o) => plazoMax == null || o.plazoHoras <= plazoMax)
          .where((o) => maxPorCaja == null || o.unidadesPorCaja <= maxPorCaja)
          .toList();
      if (ofertas.isEmpty) continue;

      final precios = ofertas.map((o) => o.precioUnitario).toList()..sort();
      items.add({
        ..._productoJson(p),
        'precioDesde': precios.first,
        'precioHasta': precios.last,
        'ofertas': ofertas.length,
        'plazoMinHoras': ofertas.map((o) => o.plazoHoras).reduce((a, b) => a < b ? a : b),
      });
    }

    int diferencia(Map<String, dynamic> i) => (i['precioHasta'] as int) - (i['precioDesde'] as int);
    switch (orden) {
      case 'precio':
        items.sort((a, b) => (a['precioDesde'] as int).compareTo(b['precioDesde'] as int));
      case 'diferencia':
        items.removeWhere((i) => (i['ofertas'] as int) < 2);
        items.sort((a, b) => diferencia(b).compareTo(diferencia(a)));
      case 'nombre':
        items.sort((a, b) => (a['nombre'] as String).compareTo(b['nombre'] as String));
    }

    final desde = (pagina - 1) * porPagina;
    return {
      'items': items.skip(desde).take(porPagina).toList(),
      'total': items.length,
      'pagina': pagina,
      'porPagina': porPagina,
    };
  }

  @override
  Future<Map<String, dynamic>> producto(int id, {required String origen}) async {
    await Future<void>.delayed(latencia);

    final p = seedProductos.where((p) => p.id == id).firstOrNull;
    if (p == null) throw const NotFoundFailure('Este producto ya no está disponible.');
    final categoria = seedCategorias.firstWhere((c) => c.id == p.categoriaId);
    final padre = categoria.padreId == null ? null : seedCategorias.firstWhere((c) => c.id == categoria.padreId);

    final ofertas = _ofertasVisibles(id)..sort((a, b) => a.precioUnitario.compareTo(b.precioUnitario));
    return {
      ..._productoJson(p),
      'descripcion': null,
      'precioReferencia': p.precioReferencia,
      'categoria': {
        'id': categoria.id,
        'nombre': categoria.nombre,
        'padre': padre == null ? null : {'id': padre.id, 'nombre': padre.nombre},
      },
      'ofertas': [
        for (final o in ofertas)
          {
            'id': o.id,
            'precioUnitario': o.precioUnitario,
            'unidadesPorCaja': o.unidadesPorCaja,
            'cajasDisponibles': o.cajasDisponibles,
            'minimoCompra': o.minimoCompra,
            'plazoHoras': o.plazoHoras,
            'modalidadEntrega': o.modalidadEntrega,
            'notasCliente': null,
            'proveedor': _proveedorJson(o.proveedorId),
          },
      ],
    };
  }

  static List<SeedOferta> _ofertasVisibles(int productoId) => seedOfertas
      .where((o) => o.productoId == productoId && o.estado == 'publicada')
      .where((o) => seedOrganizacion(o.proveedorId).estado == 'activa')
      .toList();

  static int? _padreDe(int categoriaId) => seedCategorias.firstWhere((c) => c.id == categoriaId).padreId;

  static Map<String, dynamic> _productoJson(SeedProducto p) => {
        'id': p.id,
        'sku': p.sku,
        'nombre': p.nombre,
        'marca': p.marca,
        'formato': p.formato,
        'contenido': p.contenido,
        'unidad': p.unidad,
        'categoriaId': p.categoriaId,
        'imagenUrl': null,
      };

  static Map<String, dynamic> _proveedorJson(int id) {
    final org = seedOrganizacion(id);
    final datos = seedProveedor(id);
    final puntajes = seedCalificaciones.where((c) => c.proveedorId == id).map((c) => c.puntaje).toList();
    return {
      'id': id,
      'nombre': org.nombre,
      'entregasATiempoPct': datos.entregasATiempoPct,
      'despachoGratisDesde': datos.despachoGratisDesde,
      'costoDespacho': datos.costoDespachoRM,
      'calificacion': {
        'promedio': puntajes.isEmpty ? null : puntajes.reduce((a, b) => a + b) / puntajes.length,
        'cantidad': puntajes.length,
      },
    };
  }
}

// Búsqueda sin tildes ni mayúsculas ("azucar" encuentra "Azúcar").
String _normalizar(String s) {
  const conTilde = 'áéíóúüñ';
  const sinTilde = 'aeiouun';
  final minus = s.toLowerCase().trim();
  final buffer = StringBuffer();
  for (final ch in minus.split('')) {
    final i = conTilde.indexOf(ch);
    buffer.write(i >= 0 ? sinTilde[i] : ch);
  }
  return buffer.toString();
}
