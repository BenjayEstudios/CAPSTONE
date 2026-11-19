import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../data/checkout_datasource.dart';
import '../data/checkout_fake_datasource.dart';
import '../data/checkout_remote_datasource.dart';
import '../data/checkout_repository_impl.dart';
import '../domain/checkout.dart';
import '../domain/checkout_repository.dart';

// POST /carro/confirmar existe; opciones de entrega, comunas e inicio de
// pago no (API_CONTRACT.md). Con USE_FAKES=true todo va a FakeBackend.
final checkoutDatasourceProvider = Provider<CheckoutDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) {
    return CheckoutFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
        latencia: ref.watch(latenciaFakeProvider));
  }
  return CheckoutRemoteDatasource(ref.watch(apiClientProvider));
});

final checkoutRepositoryProvider = Provider<CheckoutRepository>((ref) {
  return CheckoutRepositoryImpl(ref.watch(checkoutDatasourceProvider));
});

final opcionesEntregaProvider = FutureProvider.autoDispose<OpcionesEntrega>((ref) {
  return ref.watch(checkoutRepositoryProvider).opcionesEntrega();
});

final comunasProvider = FutureProvider<List<Comuna>>((ref) => ref.watch(checkoutRepositoryProvider).comunas());

// La pasarela simulada resuelve el pago directo en FakeBackend (lo que haría
// la pasarela real al volver). null contra la API real.
final pasarelaSimuladaProvider = Provider<FakeBackend?>((ref) {
  return ref.watch(appConfigProvider).usarFakes ? ref.watch(fakeBackendProvider) : null;
});
