import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Persistencia de la sesión en el dispositivo, para no pedir login cada vez
// que se abre la app. Guarda el mismo JSON que responde /auth/login.
abstract interface class SesionLocalDatasource {
  Future<Map<String, dynamic>?> leer();
  Future<void> guardar(Map<String, dynamic> json);
  Future<void> borrar();
}

// Keystore en Android / Keychain en iOS: el JWT no queda en texto plano.
class SesionSecureStorage implements SesionLocalDatasource {
  const SesionSecureStorage(this._storage);

  static const _clave = 'cotizapp.sesion';
  final FlutterSecureStorage _storage;

  @override
  Future<Map<String, dynamic>?> leer() async {
    final valor = await _storage.read(key: _clave);
    return valor == null ? null : Map<String, dynamic>.from(jsonDecode(valor) as Map);
  }

  @override
  Future<void> guardar(Map<String, dynamic> json) => _storage.write(key: _clave, value: jsonEncode(json));

  @override
  Future<void> borrar() => _storage.delete(key: _clave);
}
