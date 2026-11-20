import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_providers.dart';
import 'carro_datasource.dart';

class CarroFakeDatasource implements CarroDatasource {
  const CarroFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});

  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> obtener() => llamadaFake(latencia, () => _backend.obtenerCarro(_usuario()));

  @override
  Future<Map<String, dynamic>> reemplazar(Map<String, dynamic> body) =>
      llamadaFake(latencia, () => _backend.reemplazarCarro(_usuario(), body));
}
