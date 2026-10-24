// Endpoints del catálogo (ver API_CONTRACT.md). Devuelven el JSON tal cual;
// el mapeo a entidades vive en catalogo_json.dart.
abstract interface class CatalogoDatasource {
  // GET /categorias
  Future<List<Map<String, dynamic>>> categorias();

  // GET /productos?q&categoriaId&plazoMaxHoras&maxUnidadesPorCaja&orden&porPagina
  Future<Map<String, dynamic>> productos(Map<String, dynamic> query);

  // GET /productos/:id?origen=
  Future<Map<String, dynamic>> producto(int id, {required String origen});
}
