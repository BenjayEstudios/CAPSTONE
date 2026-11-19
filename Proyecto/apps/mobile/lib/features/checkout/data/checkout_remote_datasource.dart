import '../../../core/network/api_client.dart';
import 'checkout_datasource.dart';

class CheckoutRemoteDatasource implements CheckoutDatasource {
  const CheckoutRemoteDatasource(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> opcionesEntrega() async =>
      Map<String, dynamic>.from(await _api.get('/carro/opciones-entrega') as Map);

  @override
  Future<List<Map<String, dynamic>>> comunas() async =>
      [for (final c in await _api.get('/comunas') as List) Map<String, dynamic>.from(c as Map)];

  @override
  Future<Map<String, dynamic>> confirmar(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await _api.post('/carro/confirmar', body: body) as Map);

  @override
  Future<Map<String, dynamic>> iniciarPago(int ordenId, Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await _api.post('/ordenes/$ordenId/pago', body: body) as Map);
}
