// Query: {"desde": "AAAA-MM-DD", "hasta": "AAAA-MM-DD"} (inclusivos).
abstract interface class EstadisticasDatasource {
  Future<Map<String, dynamic>> ventas(Map<String, dynamic> query);
  Future<Map<String, dynamic>> visitas(Map<String, dynamic> query);
}
