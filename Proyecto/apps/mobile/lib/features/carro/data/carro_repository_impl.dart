import '../../../core/error/failure.dart';
import '../../../core/network/parseo.dart';
import '../../catalogo/domain/catalogo_repository.dart';
import '../../catalogo/domain/producto.dart';
import '../domain/carro.dart';
import '../domain/carro_repository.dart';
import 'carro_datasource.dart';

class CarroRepositoryImpl implements CarroRepository {
  CarroRepositoryImpl(this._datasource, this._catalogo);

  final CarroDatasource _datasource;
  final CatalogoRepository _catalogo;

  // Fichas ya pedidas en esta sesión: cambiar una cantidad no vuelve a
  // pedir el catálogo.
  final _fichas = <int, ProductoDetalle?>{};

  @override
  Future<CarroDetallado> obtener() async => _detallar(await _datasource.obtener());

  @override
  Future<CarroDetallado> guardar(List<ItemCarro> items) async {
    final json = await _datasource.reemplazar({
      'items': [
        for (final i in items) {'ofertaId': i.ofertaId, 'cantidad': i.cantidad, 'precioVisto': i.precioVisto},
      ],
    });
    return _detallar(json);
  }

  Future<CarroDetallado> _detallar(Map<String, dynamic> json) async {
    final items =
        parsear(() => [for (final i in json['items'] as List) itemCarroDesdeJson(Map<String, dynamic>.from(i as Map))]);

    final productos = items.map((i) => i.productoId).whereType<int>().toSet();
    await Future.wait([
      for (final id in productos.where((id) => !_fichas.containsKey(id)))
        _catalogo.detalleProducto(id).then<void>((p) => _fichas[id] = p).catchError((Object e) {
          // Sin ficha (producto retirado) la línea igual se muestra con lo que trae /carro.
          if (e is! Failure) throw e;
          _fichas[id] = null;
        }),
    ]);

    // Grupos por proveedor en el orden en que aparecen en el carro (como
    // agrupa planificarOrden al crear los envíos).
    final grupos = <int, List<LineaCarro>>{};
    final proveedores = <int, ProveedorOferta?>{};
    for (final item in items) {
      final ficha = item.productoId == null ? null : _fichas[item.productoId];
      final oferta = ficha?.ofertas.where((o) => o.id == item.ofertaId).firstOrNull;
      final pid = item.proveedorId ?? oferta?.proveedor.id ?? 0;
      (grupos[pid] ??= []).add(LineaCarro(item: item, oferta: oferta, producto: ficha));
      proveedores[pid] ??= oferta?.proveedor;
    }
    return CarroDetallado(grupos: [
      for (final MapEntry(key: pid, value: lineas) in grupos.entries)
        GrupoCarro(proveedorId: pid, proveedor: proveedores[pid], lineas: lineas),
    ]);
  }

  // Al cambiar de usuario o cerrar sesión no se arrastran fichas viejas.
  void olvidarFichas() => _fichas.clear();
}

ItemCarro itemCarroDesdeJson(Map<String, dynamic> j) => ItemCarro(
      ofertaId: j['ofertaId'] as int,
      cantidad: j['cantidad'] as int,
      precioVisto: j['precioVisto'] as int,
      precioActual: j['precioActual'] as int?,
      productoId: j['productoId'] as int?,
      nombreProducto: j['nombreProducto'] as String?,
      formato: j['formato'] as String?,
      proveedorId: j['proveedorId'] as int?,
      disponible: j['disponible'] as bool? ?? true,
      cajasDisponibles: j['cajasDisponibles'] as int?,
    );
