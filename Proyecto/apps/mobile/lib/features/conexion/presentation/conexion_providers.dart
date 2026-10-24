import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../data/conexion_remote_datasource.dart';
import '../data/conexion_repository_impl.dart';
import '../domain/conexion_repository.dart';
import '../domain/estado_backend.dart';

// Composition root de la feature: acá se elige la implementación del
// repositorio. Los tests lo sobreescriben con overrideWithValue.
final conexionRepositoryProvider = Provider<ConexionRepository>((ref) {
  return ConexionRepositoryImpl(ConexionRemoteDatasource(ref.watch(apiClientProvider)));
});

final estadoBackendProvider = FutureProvider.autoDispose<EstadoBackend>((ref) {
  return ref.watch(conexionRepositoryProvider).verificar();
});
