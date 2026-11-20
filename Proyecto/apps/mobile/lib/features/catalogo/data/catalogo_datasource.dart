// Endpoints del catálogo (ver API_CONTRACT.md). Devuelven el JSON tal cual;
// el mapeo a entidades vive en catalogo_json.dart.
abstract interface class CatalogoDatasource {
  // GET /categorias
  Future<List<Map<String, dynamic>>> categorias();

  // GET /catalogo/productos?q&categoriaId&plazoMaxHoras&maxUnidadesPorCaja&orden&porPagina
  // (no confundir con GET /productos, que es el listado de administración)
  Future<Map<String, dynamic>> productos(Map<String, dynamic> query);

  // GET /catalogo/productos/:id?origen=
  Future<Map<String, dynamic>> producto(int id, {required String origen});
}
