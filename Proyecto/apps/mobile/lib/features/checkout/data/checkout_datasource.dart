abstract interface class CheckoutDatasource {
  Future<Map<String, dynamic>> opcionesEntrega();
  Future<List<Map<String, dynamic>>> comunas();
  Future<Map<String, dynamic>> confirmar(Map<String, dynamic> body);
  Future<Map<String, dynamic>> iniciarPago(int ordenId, Map<String, dynamic> body);
}
