import '../../../core/network/parseo.dart';
import '../domain/auth_repository.dart';
import '../domain/sesion.dart';
import 'auth_datasource.dart';
import 'sesion_json.dart';
import 'sesion_local_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._datasource, this._local);

  final AuthDatasource _datasource;
  final SesionLocalDatasource _local;

  @override
  Future<Sesion> iniciarSesion({required String email, required String clave}) async {
    final json = await _datasource.login(email: email.trim(), clave: clave);
    final sesion = parsear(() => sesionDesdeJson(json));
    await _local.guardar(sesionAJson(sesion));
    return sesion;
  }

  // Cualquier problema leyendo lo guardado (formato viejo, keystore
  // invalidado tras reinstalar) se trata como "no hay sesión": se borra y
  // se pide login de nuevo.
  @override
  Future<Sesion?> sesionGuardada() async {
    try {
      final json = await _local.leer();
      return json == null ? null : sesionDesdeJson(json);
    } catch (_) {
      await _local.borrar().catchError((_) {});
      return null;
    }
  }

  @override
  Future<void> cerrarSesion() => _local.borrar();
}
