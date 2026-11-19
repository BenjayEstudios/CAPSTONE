import '../../../core/network/api_client.dart';
import 'carro_datasource.dart';

class CarroRemoteDatasource implements CarroDatasource {
  const CarroRemoteDatasource(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> obtener() async => Map<String, dynamic>.from(await _api.get('/carro') as Map);

  @override
  Future<Map<String, dynamic>> reemplazar(Map<String, dynamic> body) async =>
      Map<String, dynamic>.from(await _api.put('/carro', body: body) as Map);
}
