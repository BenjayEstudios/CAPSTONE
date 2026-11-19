import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../data/ordenes_datasource.dart';
import '../data/ordenes_fake_datasource.dart';
import '../data/ordenes_remote_datasource.dart';
import '../data/ordenes_repository_impl.dart';
import '../domain/orden.dart';
import '../domain/ordenes_repository.dart';

// GET /ordenes, GET /ordenes/:id y PATCH de estado existen en el backend;
// sin login de cliente/proveedor no hay token, así que USE_FAKES=true usa
// FakeBackend (mismas reglas de alcance y de transición de estados).
final ordenesDatasourceProvider = Provider<OrdenesDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) {
    return OrdenesFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
        latencia: ref.watch(latenciaFakeProvider));
  }
  return OrdenesRemoteDatasource(ref.watch(apiClientProvider));
});

final ordenesRepositoryProvider = Provider<OrdenesRepository>((ref) {
  return OrdenesRepositoryImpl(ref.watch(ordenesDatasourceProvider));
});

// Lista de órdenes del usuario (cliente: sus pedidos; proveedor: las que
// tienen un envío suyo). Se invalida después de pagar, calificar o avanzar
// un envío.
final ordenesProvider = FutureProvider.autoDispose<List<Orden>>((ref) async {
  final pagina = await ref.watch(ordenesRepositoryProvider).listar(tamano: 100);
  return pagina.items;
});

final ordenProvider = FutureProvider.autoDispose.family<Orden, int>((ref, id) {
  return ref.watch(ordenesRepositoryProvider).obtener(id);
});
