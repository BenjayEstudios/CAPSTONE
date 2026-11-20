import 'package:cotizapp_mobile/core/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';

Future<void> _entrarComoComprador(WidgetTester tester) async {
  usarPantallaDeTelefono(tester);
  await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Comprador'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el inicio muestra categorías y los productos con mayor diferencia', (tester) async {
    await _entrarComoComprador(tester);

    expect(find.text('Categorías'), findsOneWidget);
    expect(find.text('Abarrotes'), findsOneWidget);
    expect(find.text('Mayor diferencia de precio hoy'), findsOneWidget);
    expect(find.text('Harina sin polvos de hornear'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('categoría -> listado -> ficha con comparador', (tester) async {
    await _entrarComoComprador(tester);

    await tester.tap(find.text('Abarrotes'));
    await tester.pumpAndSettle();
    expect(find.text('4 productos'), findsOneWidget);

    await tester.tap(find.text('Aceite vegetal maravilla'));
    await tester.pumpAndSettle();

    expect(find.text('2 proveedores lo venden'), findsOneWidget);
    expect(find.text('Los Andes Food Service'), findsOneWidget);
    expect(find.text('Más bajo'), findsOneWidget);
    expect(find.text('4,7'), findsOneWidget);
    expect(tester.takeException(), isNull);

    // Ordenar por plazo deja primero a Los Andes (24 h) y sigue sin errores.
    await tester.tap(find.text('Plazo'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    // Atrás vuelve al listado y luego al inicio.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('4 productos'), findsOneWidget);
  });

  testWidgets('la búsqueda filtra mientras se escribe', (tester) async {
    await _entrarComoComprador(tester);

    await tester.tap(find.text('Busca aceite, harina, queso…'));
    await tester.pumpAndSettle();
    expect(find.text('17 productos'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'queso');
    await tester.pump(const Duration(milliseconds: 400)); // debounce
    await tester.pumpAndSettle();
    expect(find.text('2 productos'), findsOneWidget);
    expect(find.text('Queso gauda laminado'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'xyz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('No encontramos productos'), findsOneWidget);
  });

  testWidgets('filtro rápido de 24 h y hoja de filtros', (tester) async {
    await _entrarComoComprador(tester);
    await tester.tap(find.text('Ver todo'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Entrega 24 h'));
    await tester.pumpAndSettle();
    expect(find.text('15 productos'), findsOneWidget);

    await tester.tap(find.text('Filtros (1)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bebidas'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aplicar'));
    await tester.pumpAndSettle();

    expect(find.text('1 producto'), findsOneWidget);
    expect(find.text('Bebida cola'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
