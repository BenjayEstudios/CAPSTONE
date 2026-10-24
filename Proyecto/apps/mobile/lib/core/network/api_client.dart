import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/sesion_controller.dart';
import '../config/app_config.dart';
import '../error/failure.dart';

// Cliente HTTP compartido hacia apps/backend. Agrega el header
// Authorization con el token de la sesión (si hay) y traduce los errores de
// Dio a Failure, así los datasources no conocen DioException. Un 401 a un
// request que llevaba token avisa por alExpirarSesion.
class ApiClient {
  ApiClient({required String baseUrl, String? Function()? leerToken, this.alExpirarSesion, Dio? dio})
      : dio = dio ??
            Dio(BaseOptions(
              baseUrl: baseUrl,
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 15),
              contentType: Headers.jsonContentType,
            )) {
    this.dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = leerToken?.call();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
    ));
  }

  final Dio dio;
  final void Function()? alExpirarSesion;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _enviar(() => dio.get<dynamic>(path, queryParameters: query));

  Future<dynamic> post(String path, {Object? body}) => _enviar(() => dio.post<dynamic>(path, data: body));

  Future<dynamic> put(String path, {Object? body}) => _enviar(() => dio.put<dynamic>(path, data: body));

  Future<dynamic> patch(String path, {Object? body}) => _enviar(() => dio.patch<dynamic>(path, data: body));

  Future<dynamic> delete(String path) => _enviar(() => dio.delete<dynamic>(path));

  Future<dynamic> _enviar(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (e) {
      // Sin token (ej. login con clave mala) el 401 no significa sesión vencida.
      final conToken = e.requestOptions.headers.containsKey('Authorization');
      if (e.response?.statusCode == 401 && conToken) alExpirarSesion?.call();
      throw failureDesdeDio(e);
    }
  }
}

// El backend responde los errores como {"error": {"code", "message"}} (ver
// setErrorHandler en apps/backend/src/server/app.ts y plugins/auth.ts).
Failure failureDesdeDio(DioException e) {
  final response = e.response;
  if (response == null) {
    return const NetworkFailure('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  String? code;
  String? message;
  final data = response.data;
  if (data is Map && data['error'] is Map) {
    code = data['error']['code'] as String?;
    message = data['error']['message'] as String?;
  }

  return switch (response.statusCode ?? 0) {
    401 => UnauthorizedFailure(message ?? 'Tu sesión expiró. Vuelve a ingresar.'),
    403 => ForbiddenFailure(message ?? 'No tienes permiso para esto.'),
    404 => NotFoundFailure(message ?? 'No encontramos lo que buscabas.'),
    400 || 409 || 422 => ValidationFailure(message ?? 'Revisa los datos ingresados.', code: code),
    _ => ServerFailure(message ?? 'El servidor tuvo un problema. Intenta de nuevo.'),
  };
}

// El token se lee de la sesión en cada request (ref.read dentro del
// callback, no en el build, para no crear un ciclo entre providers).
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    baseUrl: ref.watch(appConfigProvider).apiUrl,
    leerToken: () => ref.read(sesionProvider).valueOrNull?.token,
    alExpirarSesion: () => ref.read(sesionProvider.notifier).expirar(),
  );
});
