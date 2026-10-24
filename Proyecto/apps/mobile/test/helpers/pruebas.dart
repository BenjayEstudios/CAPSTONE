import 'package:cotizapp_mobile/features/auth/data/auth_datasource.dart';
import 'package:cotizapp_mobile/features/auth/data/auth_fake_datasource.dart';
import 'package:cotizapp_mobile/features/auth/data/sesion_local_datasource.dart';
import 'package:cotizapp_mobile/features/auth/presentation/auth_providers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// flutter_secure_storage es un plugin nativo y no existe en flutter test.
class SesionEnMemoria implements SesionLocalDatasource {
  SesionEnMemoria([this.guardada]);

  Map<String, dynamic>? guardada;

  @override
  Future<Map<String, dynamic>?> leer() async => guardada;

  @override
  Future<void> guardar(Map<String, dynamic> json) async => guardada = json;

  @override
  Future<void> borrar() async => guardada = null;
}

// Overrides base para levantar la app en tests: storage en memoria y fakes
// sin latencia.
List<Override> overridesDePrueba({SesionLocalDatasource? local, AuthDatasource? auth}) => [
      sesionLocalDatasourceProvider.overrideWithValue(local ?? SesionEnMemoria()),
      authDatasourceProvider.overrideWithValue(auth ?? const AuthFakeDatasource(latencia: Duration.zero)),
    ];

// La superficie por defecto de flutter test es 800x600; con esto las
// pantallas se prueban al tamaño del Pixel 8 de la demo (411x914 dp), y lo
// que en el teléfono queda bajo el pliegue también queda así en el test.
void usarPantallaDeTelefono(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.625;
  addTearDown(tester.view.reset);
}
