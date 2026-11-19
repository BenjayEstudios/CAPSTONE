// Errores de dominio/infraestructura tipados, lanzados por los repositorios
// de cada feature en vez de propagar excepciones crudas de Dio. Riverpod los
// deja en AsyncValue.error, y ErrorView muestra su message.
//
// code y detalle vienen del cuerpo de error del backend
// ({"error": {"code", "message", "detalle"}}, ver
// apps/backend/src/lib/error-handler.ts): el checkout los usa para explicar
// un 409 (PRECIO_CAMBIO, SIN_STOCK, ...) línea por línea.
sealed class Failure implements Exception {
  const Failure(this.message, {this.code, this.detalle});
  final String message;
  final String? code;
  final Object? detalle;

  @override
  String toString() => message;
}

// Sin respuesta del servidor: sin red, timeout, backend apagado.
class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

// 5xx o respuesta que no se pudo interpretar.
class ServerFailure extends Failure {
  const ServerFailure(super.message, {super.code});
}

// 401: falta el token o expiró. Gatilla volver al login.
class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure(super.message, {super.code});
}

// 403: logueado, pero el rol no tiene permiso.
class ForbiddenFailure extends Failure {
  const ForbiddenFailure(super.message, {super.code});
}

class NotFoundFailure extends Failure {
  const NotFoundFailure(super.message, {super.code, super.detalle});
}

// 400/409/422: el request no pasó la validación del backend (zod) o choca
// con el estado actual (ej. stock insuficiente).
class ValidationFailure extends Failure {
  const ValidationFailure(super.message, {super.code, super.detalle});
}
