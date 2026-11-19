import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../carro/carro_flujo_test.dart' show entrarComo, irA;

void main() {
  testWidgets('resumen: KPIs del mes en curso vs el mismo tramo, octubre completo y visitas', (tester) async {
    await entrarComo(tester, 'Distribuidor');
    expect(find.text('Cifras al 18 de noviembre, comparadas con el mismo tramo de octubre.'), findsOneWidget);

    await tester.tap(find.text('Octubre'));
    await tester.pumpAndSettle();
    expect(find.text(r'$218.070'), findsOneWidget);
    expect(find.text(r'$210.604'), findsOneWidget);

    await tester.tap(find.text('Visitas'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Últimos 90 días'));
    await tester.pumpAndSettle();
    expect(find.text('1094'), findsOneWidget);
    expect(find.text('213'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reseñas y alertas del distribuidor', (tester) async {
    await entrarComo(tester, 'Distribuidor');
    await irA(tester, 'Reseñas');
    expect(find.text('4,7'), findsOneWidget);
    expect(find.text('6 calificaciones'), findsOneWidget);
    expect(find.text('96,5%'), findsOneWidget);

    await irA(tester, 'Alertas');
    expect(find.text(r'$97.367'), findsOneWidget);
    expect(find.text('Stock bajo: Leche entera'), findsOneWidget);
    // Badge con los 2 avisos.
    expect(find.descendant(of: find.byType(Badge), matching: find.text('2')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
