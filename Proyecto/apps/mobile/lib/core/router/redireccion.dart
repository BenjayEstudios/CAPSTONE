import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/domain/perfil.dart';
import '../../features/auth/domain/sesion.dart';
import 'rutas.dart';

// Decide a dónde mandar al usuario según el estado de la sesión y la ruta
// pedida. null = dejarlo pasar. Función pura para poder testearla sin
// levantar el router.
String? redirigir(AsyncValue<Sesion?> sesion, String ruta) {
  // Restaurando la sesión guardada al abrir la app.
  if (sesion.isLoading && !sesion.hasValue) {
    return ruta == Rutas.splash ? null : Rutas.splash;
  }

  // Un error al restaurar se trata como "sin sesión".
  final actual = sesion.valueOrNull;
  final publica = ruta == Rutas.login || ruta == Rutas.conexion;

  if (actual == null) return publica ? null : Rutas.login;

  final inicio = Rutas.inicioDe(actual.perfil);
  if (ruta == Rutas.splash || ruta == Rutas.login) return inicio;

  final prefijoAjeno = actual.perfil == Perfil.comprador ? Rutas.proveedor : Rutas.comprador;
  if (ruta == prefijoAjeno || ruta.startsWith('$prefijoAjeno/')) return inicio;

  return null;
}
