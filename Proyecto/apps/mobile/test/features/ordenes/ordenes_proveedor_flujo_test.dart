import 'package:cotizapp_mobile/core/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';
import '../carro/carro_flujo_test.dart' show irA, tocarEnLinea;

Future<void> ingresar(WidgetTester tester, String correo) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), correo);
  await tester.enterText(find.widgetWithText(TextFormField, 'Clave'), 'Cotizapp.2026');
  await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
  await tester.pumpAndSettle();
}

Future<void> cerrarSesion(WidgetTester tester) async {
  await irA(tester, 'Cuenta');
  await tester.tap(find.text('Cerrar sesión'));
  await tester.pumpAndSettle();
}

Future<void> confirmarDialogo(WidgetTester tester) async {
  await tester.tap(find.text('Confirmar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el distribuidor ve sus envíos vigentes y los avanza hasta entregado', (tester) async {
    usarPantallaDeTelefono(tester);
    await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
    await tester.pumpAndSettle();
    await ingresar(tester, 'pedidos@vallecentral.test');
    await irA(tester, 'Órdenes');

    // Valle Central: CM-10002 en preparación y CM-10011 por despachar.
    expect(find.text('Vigentes (2)'), findsOneWidget);
    expect(find.text('CM-10011'), findsOneWidget);
    expect(find.text('Empezar a preparar'), findsOneWidget);

    await tester.tap(find.text('Empezar a preparar'));
    await tester.pumpAndSettle();
    await confirmarDialogo(tester);
    expect(find.text('Marcar despachado'), findsNWidgets(2));

    // CM-10002 es la más antigua: queda primera.
    await tester.tap(find.text('Marcar despachado').first);
    await tester.pumpAndSettle();
    await confirmarDialogo(tester);
    await tester.tap(find.text('Marcar entregado'));
    await tester.pumpAndSettle();
    await confirmarDialogo(tester);
    expect(find.text('Vigentes (1)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('lo que paga el comprador le llega al distribuidor, y el avance vuelve al comprador', (tester) async {
    usarPantallaDeTelefono(tester);
    await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
    await tester.pumpAndSettle();

    // Comprador: paga queso de FrigoSur y tomate de Valle Central.
    await tester.tap(find.text('Comprador'));
    await tester.pumpAndSettle();
    await irA(tester, 'Carro');
    await tocarEnLinea(tester, 'Leche entera', 'Quitar del carro');
    await tester.tap(find.text('Ir a pagar'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining(RegExp(r'^Pagar \$')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aprobar pago'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Folio CM-90012'), findsOneWidget);
    await cerrarSesion(tester);

    // Distribuidor FrigoSur: la orden nueva aparece por despachar.
    await ingresar(tester, 'comercial@frigosur.test');
    await irA(tester, 'Órdenes');
    expect(find.text('CM-90012'), findsOneWidget);
    expect(find.text('El Fogón'), findsOneWidget);
    await tester.tap(find.text('Empezar a preparar'));
    await tester.pumpAndSettle();
    await confirmarDialogo(tester);
    await cerrarSesion(tester);

    // Comprador: ve el envío de FrigoSur en preparación.
    await tester.tap(find.text('Comprador'));
    await tester.pumpAndSettle();
    await irA(tester, 'Pedidos');
    expect(find.text('En preparación'), findsWidgets);
  });
}
