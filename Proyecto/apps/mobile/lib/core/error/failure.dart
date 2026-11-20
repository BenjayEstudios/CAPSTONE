// Errores de dominio/infraestructura tipados, lanzados por los repositorios
// de cada feature en vez de propagar excepciones crudas de Dio. Riverpod los
// deja en AsyncValue.error, y ErrorView muestra su message.
sealed class Failure implements Exception {
  const Failure(this.message);
  final String message;

  @override
  String toString() => message;
}

// Sin respuesta del servidor: sin red, timeout, backend apagado.
class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

// 5xx o respuesta que no se pudo interpretar.
class ServerFailure extends Failure {
  const ServerFailure(super.message);
}

// 401: falta el token o expiró. Gatilla volver al login.
class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure(super.message);
}

// 403: logueado, pero el rol no tiene permiso.
class ForbiddenFailure extends Failure {
  const ForbiddenFailure(super.message);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure(super.message);
}

// 400/409/422: el request no pasó la validación del backend (zod) o choca
// con el estado actual (ej. stock insuficiente).
class ValidationFailure extends Failure {
  const ValidationFailure(super.message, {this.code});
  final String? code;
}
