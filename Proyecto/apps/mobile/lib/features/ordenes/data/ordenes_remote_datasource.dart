import '../../../core/network/api_client.dart';
import 'ordenes_datasource.dart';

class OrdenesRemoteDatasource implements OrdenesDatasource {
  const OrdenesRemoteDatasource(this._api);

  final ApiClient _api;

  Map<String, dynamic> _mapa(Object? data) => Map<String, dynamic>.from(data as Map);

  @override
  Future<Map<String, dynamic>> listar(Map<String, dynamic> query) async =>
      _mapa(await _api.get('/ordenes', query: query));

  @override
  Future<Map<String, dynamic>> obtener(int id) async => _mapa(await _api.get('/ordenes/$id'));

  @override
  Future<Map<String, dynamic>> cambiarEstadoEnvio(int envioId, Map<String, dynamic> body) async =>
      _mapa(await _api.patch('/ordenes/envios/$envioId/estado', body: body));

  @override
  Future<Map<String, dynamic>> calificarEnvio(int envioId, Map<String, dynamic> body) async =>
      _mapa(await _api.post('/ordenes/envios/$envioId/calificacion', body: body));
}
