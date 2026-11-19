import '../../../core/network/api_client.dart';
import 'catalogo_datasource.dart';

class CatalogoRemoteDatasource implements CatalogoDatasource {
  const CatalogoRemoteDatasource(this._api);

  final ApiClient _api;

  @override
  Future<List<Map<String, dynamic>>> categorias() async {
    final data = await _api.get('/categorias') as List;
    return [for (final c in data) Map<String, dynamic>.from(c as Map)];
  }

  @override
  Future<Map<String, dynamic>> productos(Map<String, dynamic> query) async {
    final data = await _api.get('/productos', query: query);
    return Map<String, dynamic>.from(data as Map);
  }

  @override
  Future<Map<String, dynamic>> producto(int id, {required String origen}) async {
    final data = await _api.get('/productos/$id', query: {'origen': origen});
    return Map<String, dynamic>.from(data as Map);
  }
}
