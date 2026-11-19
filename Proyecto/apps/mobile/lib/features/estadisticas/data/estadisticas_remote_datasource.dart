import '../../../core/network/api_client.dart';
import 'estadisticas_datasource.dart';

class EstadisticasRemoteDatasource implements EstadisticasDatasource {
  const EstadisticasRemoteDatasource(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> ventas(Map<String, dynamic> query) async =>
      Map<String, dynamic>.from(await _api.get('/estadisticas/proveedor/ventas', query: query) as Map);

  @override
  Future<Map<String, dynamic>> visitas(Map<String, dynamic> query) async =>
      Map<String, dynamic>.from(await _api.get('/estadisticas/proveedor', query: query) as Map);
}
