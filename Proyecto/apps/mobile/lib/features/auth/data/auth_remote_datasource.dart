import '../../../core/network/api_client.dart';
import 'auth_datasource.dart';

class AuthRemoteDatasource implements AuthDatasource {
  const AuthRemoteDatasource(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> login({required String email, required String clave}) async {
    final data = await _api.post('/auth/login', body: {'email': email, 'clave': clave});
    return Map<String, dynamic>.from(data as Map);
  }
}
