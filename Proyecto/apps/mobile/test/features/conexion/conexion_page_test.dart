import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/features/conexion/domain/conexion_repository.dart';
import 'package:cotizapp_mobile/features/conexion/domain/estado_backend.dart';
import 'package:cotizapp_mobile/features/conexion/presentation/conexion_page.dart';
import 'package:cotizapp_mobile/features/conexion/presentation/conexion_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

class _RepoFijo implements ConexionRepository {
  _RepoFijo(this.respuesta);

  final Future<EstadoBackend> Function() respuesta;

  @override
  Future<EstadoBackend> verificar() => respuesta();
}

Widget _app(ConexionRepository repo) => ProviderScope(
      overrides: [conexionRepositoryProvider.overrideWithValue(repo)],
      child: const MaterialApp(home: ConexionPage()),
    );

void main() {
  setUpAll(() => initializeDateFormatting('es_CL'));

  testWidgets('muestra backend conectado', (tester) async {
    await tester.pumpWidget(_app(_RepoFijo(
      () async => EstadoBackend(ok: true, horaServidor: DateTime(2026, 10, 23, 12)),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Conexión'), findsOneWidget);
    expect(find.text('Backend conectado'), findsOneWidget);
  });

  testWidgets('sin backend muestra "sin conexión" y permite volver a probar', (tester) async {
    var intentos = 0;
    await tester.pumpWidget(_app(_RepoFijo(() async {
      intentos++;
      if (intentos == 1) throw const NetworkFailure('Sin red');
      return const EstadoBackend(ok: true);
    })));
    await tester.pumpAndSettle();

    expect(find.text('Sin conexión con el backend'), findsOneWidget);
    expect(find.textContaining('USE_FAKES=true'), findsWidgets);
    await tester.tap(find.text('Volver a probar'));
    await tester.pumpAndSettle();

    expect(find.text('Backend conectado'), findsOneWidget);
    expect(intentos, 2);
  });

  testWidgets('si en el puerto responde otro servicio lo dice', (tester) async {
    await tester.pumpWidget(_app(_RepoFijo(() async => throw const NotFoundFailure('404'))));
    await tester.pumpAndSettle();
    expect(find.text('Responde otro servicio'), findsOneWidget);
  });
}
