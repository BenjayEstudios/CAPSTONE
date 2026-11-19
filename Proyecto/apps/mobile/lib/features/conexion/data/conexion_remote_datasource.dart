import '../../../core/error/failure.dart';
import '../../../core/network/api_client.dart';

// GET /health-check -> {"status": "ok", "timestamp": "<ISO 8601>"}
// (apps/backend/src/routes/health-check). Ya existe en el backend, así que
// no tiene fake.
class ConexionRemoteDatasource {
  const ConexionRemoteDatasource(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> healthCheck() async {
    final data = await _api.get('/health-check');
    // Otro servicio en el mismo puerto puede responder 200 con HTML: el
    // health-check de Cotizapp no está ahí.
    if (data is! Map) throw const NotFoundFailure('La respuesta no es la del backend de Cotizapp.');
    return Map<String, dynamic>.from(data);
  }
}
