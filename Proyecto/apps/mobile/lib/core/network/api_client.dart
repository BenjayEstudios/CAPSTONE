import "package:dio/dio.dart";

// Cliente HTTP compartido hacia apps/rest, configurado con la base URL y
// (más adelante) el interceptor de auth del distribuidor autenticado.
class ApiClient {
  ApiClient({required String baseUrl})
      : dio = Dio(BaseOptions(baseUrl: baseUrl));

  final Dio dio;
}
