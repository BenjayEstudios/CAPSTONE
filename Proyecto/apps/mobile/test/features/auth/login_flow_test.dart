import 'package:cotizapp_mobile/core/app.dart';
import 'package:cotizapp_mobile/features/auth/data/auth_fake_datasource.dart';
import 'package:cotizapp_mobile/features/auth/data/sesion_json.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';

Widget _app(WidgetTester tester, SesionEnMemoria local) {
  usarPantallaDeTelefono(tester);
  return ProviderScope(
    overrides: overridesDePrueba(local: local),
    child: const CotizappMobileApp(),
  );
}

Future<void> _ingresar(WidgetTester tester, String email, String clave) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), email);
  await tester.enterText(find.widgetWithText(TextFormField, 'Clave'), clave);
  await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sin sesión arranca en el login', (tester) async {
    await tester.pumpWidget(_app(tester, SesionEnMemoria()));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
  });

  testWidgets('valida el formulario antes de enviar', (tester) async {
    await tester.pumpWidget(_app(tester, SesionEnMemoria()));
    await tester.pumpAndSettle();
    await _ingresar(tester, 'no-es-correo', '');
    expect(find.text('Correo no válido'), findsOneWidget);
    expect(find.text('Ingresa tu clave'), findsOneWidget);
  });

  testWidgets('clave incorrecta muestra el error y sigue en el login', (tester) async {
    await tester.pumpWidget(_app(tester, SesionEnMemoria()));
    await tester.pumpAndSettle();
    await _ingresar(tester, 'compras@elfogon.test', 'mala');
    expect(find.text('Correo o clave incorrectos.'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('comprador ve su navegación y puede cerrar sesión', (tester) async {
    final local = SesionEnMemoria();
    await tester.pumpWidget(_app(tester, local));
    await tester.pumpAndSettle();
    await _ingresar(tester, 'compras@elfogon.test', 'Cotizapp.2026');

    final barra = find.byType(NavigationBar);
    for (final pestana in ['Inicio', 'Carro', 'Pedidos', 'Cuenta']) {
      expect(find.descendant(of: barra, matching: find.text(pestana)), findsOneWidget);
    }
    expect(find.descendant(of: barra, matching: find.text('Órdenes')), findsNothing);
    expect(local.guardada, isNotNull);

    await tester.tap(find.descendant(of: barra, matching: find.text('Cuenta')));
    await tester.pumpAndSettle();
    expect(find.text('Compras El Fogón'), findsOneWidget);

    await tester.tap(find.text('Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
    expect(local.guardada, isNull);
  });

  testWidgets('proveedor ve la navegación de distribuidor', (tester) async {
    await tester.pumpWidget(_app(tester, SesionEnMemoria()));
    await tester.pumpAndSettle();
    // La tarjeta de acceso rápido llena el formulario e ingresa de una vez.
    await tester.tap(find.text('Distribuidor'));
    await tester.pumpAndSettle();

    final barra = find.byType(NavigationBar);
    for (final pestana in ['Resumen', 'Órdenes', 'Reseñas', 'Alertas', 'Cuenta']) {
      expect(find.descendant(of: barra, matching: find.text(pestana)), findsOneWidget);
    }
    expect(find.descendant(of: barra, matching: find.text('Carro')), findsNothing);
    expect(find.text('Hola, Los Andes Food Service'), findsOneWidget);
  });

  testWidgets('atrás desde otra pestaña vuelve a la primera', (tester) async {
    await tester.pumpWidget(_app(tester, SesionEnMemoria()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comprador'));
    await tester.pumpAndSettle();

    final barra = find.byType(NavigationBar);
    await tester.tap(find.descendant(of: barra, matching: find.text('Pedidos')));
    await tester.pumpAndSettle();
    expect(find.text('Mis pedidos'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Hola, El Fogón'), findsOneWidget);
  });

  testWidgets('con sesión guardada entra directo sin pasar por el login', (tester) async {
    // runAsync: fuera del reloj falso de testWidgets el Future.delayed del
    // fake no avanza sin pump.
    final json = (await tester.runAsync(() => const AuthFakeDatasource(latencia: Duration.zero)
        .login(email: 'comercial@frigosur.test', clave: 'Cotizapp.2026')))!;
    await tester.pumpWidget(_app(tester, SesionEnMemoria(sesionAJson(sesionDesdeJson(json)))));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsNothing);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('Resumen')), findsOneWidget);
  });

  testWidgets('en una pantalla chica no hay overflow (login, inicio y cuenta)', (tester) async {
    tester.view.physicalSize = const Size(720, 1280);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Distribuidor'));
    await tester.tap(find.text('Distribuidor'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Cuenta')));
    await tester.pumpAndSettle();

    // Un RenderFlex desbordado se reporta como excepción del framework.
    expect(tester.takeException(), isNull);
    expect(find.text('Ventas Los Andes'), findsOneWidget);
  });
}
