import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

// Rutas de la app, una por feature de distribuidor (estadisticas, visitas,
// calificaciones, perfil). Sin pantallas todavía.
final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(routes: const []);
});
