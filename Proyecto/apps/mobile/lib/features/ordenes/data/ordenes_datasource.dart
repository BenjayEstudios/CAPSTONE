// Endpoints de órdenes (apps/backend/src/routes/ordenes) más el de
// calificación, que falta en el backend (API_CONTRACT.md).
abstract interface class OrdenesDatasource {
  Future<Map<String, dynamic>> listar(Map<String, dynamic> query);
  Future<Map<String, dynamic>> obtener(int id);
  Future<Map<String, dynamic>> cambiarEstadoEnvio(int envioId, Map<String, dynamic> body);
  Future<Map<String, dynamic>> calificarEnvio(int envioId, Map<String, dynamic> body);
}
