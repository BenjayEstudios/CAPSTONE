import 'sesion.dart';

abstract interface class AuthRepository {
  // Lanza UnauthorizedFailure si las credenciales no calzan y
  // ForbiddenFailure si la cuenta no está activa o el rol no usa esta app.
  Future<Sesion> iniciarSesion({required String email, required String clave});

  // Sesión guardada en el dispositivo, o null si no hay (o está corrupta).
  Future<Sesion?> sesionGuardada();

  Future<void> cerrarSesion();
}
