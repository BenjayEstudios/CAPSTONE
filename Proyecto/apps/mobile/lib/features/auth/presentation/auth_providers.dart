import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_datasource.dart';
import '../data/auth_fake_datasource.dart';
import '../data/auth_remote_datasource.dart';
import '../data/auth_repository_impl.dart';
import '../data/sesion_local_datasource.dart';
import '../domain/auth_repository.dart';

// Composition root de la feature. POST /auth/login todavía no existe en el
// backend: con USE_FAKES=true se valida contra los usuarios del seed.
final authDatasourceProvider = Provider<AuthDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) return const AuthFakeDatasource();
  return AuthRemoteDatasource(ref.watch(apiClientProvider));
});

final sesionLocalDatasourceProvider = Provider<SesionLocalDatasource>((ref) {
  return const SesionSecureStorage(FlutterSecureStorage());
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(ref.watch(authDatasourceProvider), ref.watch(sesionLocalDatasourceProvider));
});
