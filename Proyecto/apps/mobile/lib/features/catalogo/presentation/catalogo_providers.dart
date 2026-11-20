import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../data/catalogo_datasource.dart';
import '../data/catalogo_fake_datasource.dart';
import '../data/catalogo_remote_datasource.dart';
import '../data/catalogo_repository_impl.dart';
import '../domain/catalogo_repository.dart';
import '../domain/categoria.dart';
import '../domain/filtros_catalogo.dart';
import '../domain/producto.dart';

// Composition root del catálogo. GET /productos y /productos/:id aún no
// existen en el backend: con USE_FAKES=true todo sale del seed.
final catalogoDatasourceProvider = Provider<CatalogoDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) return const CatalogoFakeDatasource();
  return CatalogoRemoteDatasource(ref.watch(apiClientProvider));
});

final catalogoRepositoryProvider = Provider<CatalogoRepository>((ref) {
  return CatalogoRepositoryImpl(ref.watch(catalogoDatasourceProvider));
});

// Sin autoDispose: las categorías casi no cambian y se usan en inicio,
// listado y filtros; se piden una vez por sesión de la app.
final categoriasProvider = FutureProvider<List<Categoria>>((ref) {
  return ref.watch(catalogoRepositoryProvider).categorias();
});

// "Mayor diferencia de precio hoy" del inicio.
final destacadosProvider = FutureProvider.autoDispose<List<ProductoResumen>>((ref) async {
  const filtros = FiltrosCatalogo(orden: OrdenCatalogo.diferencia);
  final pagina = await ref.watch(catalogoRepositoryProvider).buscarProductos(filtros, porPagina: 5);
  return pagina.items;
});

final resultadosProvider = FutureProvider.autoDispose.family<PaginaProductos, FiltrosCatalogo>((ref, filtros) {
  return ref.watch(catalogoRepositoryProvider).buscarProductos(filtros);
});

final productoProvider =
    FutureProvider.autoDispose.family<ProductoDetalle, ({int id, OrigenVista origen})>((ref, args) {
  return ref.watch(catalogoRepositoryProvider).detalleProducto(args.id, origen: args.origen);
});

// Mostrar precios por kg / L / unidad en vez de por formato (toggle del
// listado, como "Precio por unidad" del mockup). Global para que la ficha
// respete lo elegido en el listado.
final verPrecioPorUnidadProvider = StateProvider<bool>((ref) => false);
