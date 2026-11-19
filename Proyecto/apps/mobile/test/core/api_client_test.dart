import 'dart:convert';
import 'dart:typed_data';

import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/core/network/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

// Adapter que responde siempre lo mismo y guarda el último request, para
// probar el ApiClient sin levantar el backend.
class _AdapterFijo implements HttpClientAdapter {
  _AdapterFijo(this.status, this.body);

  final int status;
  final Object body;
  RequestOptions? ultimo;

  @override
  Future<ResponseBody> fetch(
      RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    ultimo = options;
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _cliente(_AdapterFijo adapter, {String? token, void Function()? alExpirar}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))..httpClientAdapter = adapter;
  return ApiClient(baseUrl: 'http://api.test', dio: dio, leerToken: () => token, alExpirarSesion: alExpirar);
}

void main() {
  test('devuelve el body decodificado', () async {
    final api = _cliente(_AdapterFijo(200, {'status': 'ok'}));
    expect(await api.get('/health-check'), {'status': 'ok'});
  });

  test('agrega Authorization cuando hay token', () async {
    final adapter = _AdapterFijo(200, {});
    await _cliente(adapter, token: 'abc').get('/x');
    expect(adapter.ultimo!.headers['Authorization'], 'Bearer abc');
  });

  test('sin token no agrega Authorization', () async {
    final adapter = _AdapterFijo(200, {});
    await _cliente(adapter).get('/x');
    expect(adapter.ultimo!.headers.containsKey('Authorization'), isFalse);
  });

  test('traduce el formato de error del backend a Failure', () async {
    final error = {
      'error': {'code': 'UNAUTHORIZED', 'message': 'Falta el token'}
    };
    await expectLater(
      _cliente(_AdapterFijo(401, error)).get('/x'),
      throwsA(isA<UnauthorizedFailure>().having((f) => f.message, 'message', 'Falta el token')),
    );
  });

  test('mapea códigos HTTP a cada tipo de Failure', () async {
    Future<Object?> fallo(int status) async {
      try {
        await _cliente(_AdapterFijo(status, {})).get('/x');
      } catch (e) {
        return e;
      }
      return null;
    }

    expect(await fallo(403), isA<ForbiddenFailure>());
    expect(await fallo(404), isA<NotFoundFailure>());
    expect(await fallo(422), isA<ValidationFailure>());
    expect(await fallo(500), isA<ServerFailure>());
  });

  test('401 con token avisa que la sesión expiró', () async {
    var expiro = false;
    final api = _cliente(_AdapterFijo(401, {}), token: 'vencido', alExpirar: () => expiro = true);
    await expectLater(api.get('/x'), throwsA(isA<UnauthorizedFailure>()));
    expect(expiro, isTrue);
  });

  test('401 sin token (login fallido) no cierra la sesión', () async {
    var expiro = false;
    final api = _cliente(_AdapterFijo(401, {}), alExpirar: () => expiro = true);
    await expectLater(api.post('/auth/login'), throwsA(isA<UnauthorizedFailure>()));
    expect(expiro, isFalse);
  });

  test('sin respuesta es NetworkFailure', () {
    final failure = failureDesdeDio(DioException.connectionError(
      requestOptions: RequestOptions(path: '/x'),
      reason: 'connection refused',
    ));
    expect(failure, isA<NetworkFailure>());
  });
}
