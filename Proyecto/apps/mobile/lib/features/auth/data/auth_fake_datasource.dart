import '../../../core/error/failure.dart';
import '../../../core/fake/seed.dart';
import 'auth_datasource.dart';

// Reemplaza POST /auth/login mientras el backend no lo tenga. Valida contra
// los usuarios del seed y responde con los mismos errores (tipo y mensaje)
// que debería dar la API.
class AuthFakeDatasource implements AuthDatasource {
  const AuthFakeDatasource({this.latencia = const Duration(milliseconds: 400)});

  final Duration latencia;

  @override
  Future<Map<String, dynamic>> login({required String email, required String clave}) async {
    await Future<void>.delayed(latencia);

    final usuario = seedUsuarios.where((u) => u.email == email.trim().toLowerCase()).firstOrNull;
    if (usuario == null || clave != claveSeed) {
      throw const UnauthorizedFailure('Credenciales invalidas', code: 'CREDENCIALES_INVALIDAS');
    }
    final organizacion = seedOrganizacion(usuario.organizacionId);
    if (usuario.estado != 'activo' || organizacion.estado != 'activa') {
      throw const ForbiddenFailure('Usuario no activo', code: 'USUARIO_NO_ACTIVO');
    }

    return {
      'token': 'fake-token-${usuario.id}',
      'usuario': {
        'id': usuario.id,
        'nombre': usuario.nombre,
        'email': usuario.email,
        // Misma forma que UsuarioSesionDto de POST /auth/admin/login, más
        // el objeto organizacion (API_CONTRACT.md).
        'organizacionId': organizacion.id,
        'rol': usuario.rol,
        'permisos': const <String, String>{},
        'organizacion': {'id': organizacion.id, 'nombre': organizacion.nombre, 'tipo': organizacion.tipo},
      },
    };
  }
}
