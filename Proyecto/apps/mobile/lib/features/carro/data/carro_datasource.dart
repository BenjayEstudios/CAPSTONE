// GET /carro y PUT /carro (apps/backend/src/routes/carro). Requieren token
// de un usuario de organización cliente.
abstract interface class CarroDatasource {
  Future<Map<String, dynamic>> obtener();

  // body: {"items": [{"ofertaId", "cantidad", "precioVisto"}]}
  Future<Map<String, dynamic>> reemplazar(Map<String, dynamic> body);
}
