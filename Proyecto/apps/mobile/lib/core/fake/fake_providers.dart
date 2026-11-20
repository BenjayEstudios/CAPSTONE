import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/sesion_controller.dart';
import 'fake_backend.dart';

// Reloj de la app (rangos de estadísticas, "hoy" del fake). Los tests lo
// fijan para que los resultados no dependan del día en que corren.
final ahoraProvider = Provider<DateTime Function()>((ref) => DateTime.now);

// Una sola instancia por ejecución de la app: todos los datasources fake
// comparten el mismo estado (ver FakeBackend).
final fakeBackendProvider = Provider<FakeBackend>((ref) => FakeBackend(ahora: ref.watch(ahoraProvider)));

// Id del usuario logueado, para los fakes: el token fake es
// "fake-token-<id>" (AuthFakeDatasource), así como el backend real saca el
// id del claim sub del JWT. Se lee en cada llamada, no al construir.
final usuarioFakeProvider = Provider<int Function()>((ref) {
  return () {
    final token = ref.read(sesionProvider).valueOrNull?.token;
    final id = int.tryParse(token?.replaceFirst('fake-token-', '') ?? '');
    if (id == null) FakeBackend.error(401, 'UNAUTHORIZED', 'Falta el token');
    return id;
  };
});

// Latencia simulada de los fakes, para que se vean los estados de carga.
// Los tests la dejan en cero.
final latenciaFakeProvider = Provider<Duration>((ref) => const Duration(milliseconds: 300));

Future<T> llamadaFake<T>(Duration latencia, T Function() operacion) async {
  await Future<void>.delayed(latencia);
  return operacion();
}
