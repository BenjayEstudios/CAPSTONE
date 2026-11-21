import 'package:cotizapp_mobile/core/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';
import '../carro/carro_flujo_test.dart' show irA;

Future<void> entrarConCorreo(WidgetTester tester, String correo) async {
  usarPantallaDeTelefono(tester);
  await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), correo);
  await tester.enterText(find.widgetWithText(TextFormField, 'Clave'), 'Cotizapp.2026');
  await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mis pedidos lista las órdenes con estado y abre el detalle', (tester) async {
    await entrarConCorreo(tester, 'compras@elfogon.test');
    await irA(tester, 'Pedidos');
    expect(find.text('CM-10011'), findsOneWidget);
    expect(find.text('Pagada'), findsOneWidget);

    await tester.tap(find.text('CM-10011'));
    await tester.pumpAndSettle();
    expect(find.text('Valle Central Mayorista'), findsOneWidget);
    expect(find.text('Por despachar'), findsWidgets);
    expect(find.text(r'$34.910'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('calificar un envío entregado desde el detalle', (tester) async {
    await entrarConCorreo(tester, 'compras@dulcehogar.test');
    await irA(tester, 'Pedidos');
    await tester.tap(find.text('CM-10010'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Calificar a FrigoSur'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('4 estrellas'));
    await tester.pump();
    await tester.enterText(find.widgetWithText(TextField, 'Comentario (opcional)'), 'Buena cadena de frío');
    await tester.tap(find.text('Enviar calificación'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Gracias'), findsOneWidget);
    expect(find.text('Calificar a FrigoSur'), findsNothing);
    expect(find.text('“Buena cadena de frío”'), findsOneWidget);
  });
}
