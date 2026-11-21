import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../carro/carro_flujo_test.dart' show entrarComo, irA, tocarEnLinea;

Future<void> irAlCheckoutConCarroPagable(WidgetTester tester) async {
  await entrarComo(tester, 'Comprador');
  await irA(tester, 'Carro');
  // Saca la leche (24 cajas con 20 en stock) para poder pagar.
  await tocarEnLinea(tester, 'Leche entera', 'Quitar del carro');
  await tester.tap(find.text('Ir a pagar'));
  await tester.pumpAndSettle();
}

Future<void> pagar(WidgetTester tester) async {
  await tester.tap(find.textContaining(RegExp(r'^Pagar \$')));
  await tester.pump();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('checkout completo: pago aprobado muestra el folio y vacía el carro', (tester) async {
    await irAlCheckoutConCarroPagable(tester);
    expect(find.text('Quién compra'), findsOneWidget);
    expect(find.text('Av. Irarrázaval 3450, Local 2, Ñuñoa'), findsOneWidget);
    // FrigoSur ofrece retiro en Planta Renca; Valle Central solo despacha.
    expect(find.text('Retiro en Planta Renca'), findsOneWidget);
    expect(find.text('Este proveedor solo despacha.'), findsOneWidget);
    // queso 31470 + tomate 13900 + despachos 6990 + 5990
    expect(find.text(r'Pagar $58.350'), findsOneWidget);

    await tester.tap(find.text('Retiro en Planta Renca'));
    await tester.pumpAndSettle();
    expect(find.text(r'Pagar $51.360'), findsOneWidget);

    await pagar(tester);
    expect(find.text('Pasarela de pago'), findsOneWidget);
    expect(find.text('CM-90012'), findsOneWidget);

    await tester.tap(find.text('Aprobar pago'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('¡Pago aprobado!'), findsOneWidget);
    expect(find.text('Folio CM-90012'), findsOneWidget);
    expect(find.byType(Badge), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pago rechazado: la orden queda guardada y se puede reintentar', (tester) async {
    await irAlCheckoutConCarroPagable(tester);
    await pagar(tester);
    await tester.tap(find.text('Rechazar pago'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('El pago no se completó'), findsOneWidget);

    await tester.tap(find.text('Reintentar pago'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aprobar pago'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('¡Pago aprobado!'), findsOneWidget);
  });

  testWidgets('empresa exige RUT válido', (tester) async {
    await irAlCheckoutConCarroPagable(tester);
    await tester.tap(find.text('Empresa'));
    await tester.pumpAndSettle();
    await pagar(tester);
    expect(find.text('La factura necesita el RUT de la empresa'), findsOneWidget);
    expect(find.text('Pasarela de pago'), findsNothing);
  });
}
