import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/sesion.dart';
import 'auth_providers.dart';

// Estado global de autenticación. El router escucha este provider para
// decidir a dónde redirigir (ver core/router/redireccion.dart):
// - loading: restaurando la sesión guardada (splash).
// - data(null): sin sesión (login).
// - data(sesion): navegación según sesion.perfil.
class SesionController extends AsyncNotifier<Sesion?> {
  @override
  Future<Sesion?> build() => ref.watch(authRepositoryProvider).sesionGuardada();

  // No pasa el estado a loading: la pantalla de login maneja su propio
  // spinner, y así el router no salta al splash mientras tanto. Los Failure
  // se propagan para que el login muestre el mensaje.
  Future<void> iniciarSesion({required String email, required String clave}) async {
    final sesion = await ref.read(authRepositoryProvider).iniciarSesion(email: email, clave: clave);
    state = AsyncData(sesion);
  }

  Future<void> cerrarSesion() async {
    await ref.read(authRepositoryProvider).cerrarSesion();
    state = const AsyncData(null);
  }

  // La API respondió 401 a un request con token: el JWT expiró o se
  // revocó. Se descarta la sesión y el router vuelve al login.
  Future<void> expirar() async {
    if (state.valueOrNull == null) return;
    await cerrarSesion();
  }
}

final sesionProvider = AsyncNotifierProvider<SesionController, Sesion?>(SesionController.new);
