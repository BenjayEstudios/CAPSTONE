import '../../../core/fake/fake_backend.dart';
import '../../../core/fake/fake_panel_proveedor.dart';
import '../../../core/fake/fake_providers.dart';
import 'estadisticas_datasource.dart';

class EstadisticasFakeDatasource implements EstadisticasDatasource {
  const EstadisticasFakeDatasource(this._backend, this._usuario, {this.latencia = Duration.zero});

  final FakeBackend _backend;
  final int Function() _usuario;
  final Duration latencia;

  @override
  Future<Map<String, dynamic>> ventas(Map<String, dynamic> query) =>
      llamadaFake(latencia, () => _backend.ventasProveedor(_usuario(), query));

  @override
  Future<Map<String, dynamic>> visitas(Map<String, dynamic> query) =>
      llamadaFake(latencia, () => _backend.estadisticasProveedor(_usuario(), query));
}
