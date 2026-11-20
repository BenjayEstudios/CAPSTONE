import '../../../core/network/parseo.dart';
import '../domain/catalogo_repository.dart';
import '../domain/categoria.dart';
import '../domain/filtros_catalogo.dart';
import '../domain/producto.dart';
import 'catalogo_datasource.dart';
import 'catalogo_json.dart';

class CatalogoRepositoryImpl implements CatalogoRepository {
  const CatalogoRepositoryImpl(this._datasource);

  final CatalogoDatasource _datasource;

  // Solo categorías activas: /categorias también devuelve las ocultas.
  @override
  Future<List<Categoria>> categorias() async {
    final json = await _datasource.categorias();
    return parsear(() => [
          for (final c in json)
            if (c['estado'] != 'oculta') categoriaDesdeJson(c),
        ]);
  }

  @override
  Future<PaginaProductos> buscarProductos(FiltrosCatalogo filtros, {int porPagina = 50}) async {
    final json = await _datasource.productos(filtros.aQuery(porPagina: porPagina));
    return parsear(() => paginaDesdeJson(json));
  }

  @override
  Future<ProductoDetalle> detalleProducto(int id, {OrigenVista origen = OrigenVista.directo}) async {
    final json = await _datasource.producto(id, origen: origen.name);
    return parsear(() => productoDetalleDesdeJson(json));
  }
}
