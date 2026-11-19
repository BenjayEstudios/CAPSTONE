import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_providers.dart';
import 'ordenes_datasource.dart';

class OrdenesFakeDatasource implements OrdenesDatasource {
  const OrdenesFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});

  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> listar(Map<String, dynamic> query) =>
      llamadaFake(latencia, () => _backend.listarOrdenes(_usuario(), query));

  @override
  Future<Map<String, dynamic>> obtener(int id) => llamadaFake(latencia, () => _backend.obtenerOrden(_usuario(), id));

  @override
  Future<Map<String, dynamic>> cambiarEstadoEnvio(int envioId, Map<String, dynamic> body) =>
      llamadaFake(latencia, () => _backend.cambiarEstadoEnvio(_usuario(), envioId, body));

  @override
  Future<Map<String, dynamic>> calificarEnvio(int envioId, Map<String, dynamic> body) =>
      llamadaFake(latencia, () => _backend.calificarEnvio(_usuario(), envioId, body));
}
