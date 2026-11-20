import 'estado_backend.dart';

// Puerto de la feature: presentation solo conoce esta interfaz, nunca el
// datasource concreto.
abstract interface class ConexionRepository {
  Future<EstadoBackend> verificar();
}
