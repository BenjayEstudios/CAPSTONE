// POST /auth/login. Devuelve el JSON de API_CONTRACT.md:
// {"token": "...", "usuario": {"id", "nombre", "email", "rol",
//  "organizacion": {"id", "nombre", "tipo"}}}
abstract interface class AuthDatasource {
  Future<Map<String, dynamic>> login({required String email, required String clave});
}
