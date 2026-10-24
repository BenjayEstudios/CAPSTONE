import '../error/failure.dart';

// Envuelve el mapeo JSON -> entidad: si la respuesta no trae la forma de
// API_CONTRACT.md (campo faltante, tipo distinto) se convierte en
// ServerFailure en vez de reventar con un TypeError en la pantalla.
T parsear<T>(T Function() mapear) {
  try {
    return mapear();
  } on Failure {
    rethrow;
  } on TypeError {
    throw const ServerFailure('El servidor respondió con un formato inesperado.');
  } on FormatException {
    throw const ServerFailure('El servidor respondió con un formato inesperado.');
  }
}
