// Errores de dominio/infraestructura tipados, devueltos por los repositorios
// de cada feature en vez de propagar excepciones crudas de Dio.
sealed class Failure {
  const Failure(this.message);
  final String message;
}

class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message);
}
