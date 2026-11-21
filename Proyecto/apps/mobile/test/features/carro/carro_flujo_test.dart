import 'package:cotizapp_mobile/core/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';

Future<void> entrarComo(WidgetTester tester, String perfil) async {
  usarPantallaDeTelefono(tester);
  await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
  await tester.pumpAndSettle();
  await tester.tap(find.text(perfil));
  await tester.pumpAndSettle();
}

// El ListView del carro construye las filas a demanda: los botones se
// buscan dentro de la línea del producto, no por índice.
Future<void> tocarEnLinea(WidgetTester tester, String producto, String tooltip) async {
  final lista = find.byType(Scrollable).first;
  if (find.text(producto).evaluate().isEmpty) {
    await tester.scrollUntilVisible(find.text(producto), -300, scrollable: lista);
  }
  final linea = find.ancestor(of: find.text(producto), matching: find.byType(Column)).first;
  final boton = find.descendant(of: linea, matching: find.byTooltip(tooltip));
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
}

Future<void> irA(WidgetTester tester, String pestana) async {
  await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(pestana)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el carro muestra grupos por proveedor, resumen y total', (tester) async {
    await entrarComo(tester, 'Comprador');
    // Badge con las 3 líneas del carro del seed.
    expect(find.descendant(of: find.byType(Badge), matching: find.text('3')), findsOneWidget);

    await irA(tester, 'Carro');
    expect(find.text('3 productos · 3 proveedores'), findsOneWidget);
    expect(find.text('Los Andes Food Service'), findsOneWidget);
    expect(find.text('Leche entera'), findsOneWidget);
    expect(find.text(r'$89.500'), findsWidgets);
    expect(find.text('Ir a pagar'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('cambiar cantidad y quitar actualizan el total', (tester) async {
    await entrarComo(tester, 'Comprador');
    await irA(tester, 'Carro');

    // La leche del seed (24 cajas) supera el stock (20): avisa y no deja pagar.
    expect(find.text('Solo quedan 20: ajusta la cantidad'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Ir a pagar')).onPressed, isNull);

    // +1 queso gauda ($10.490) sobre $89.500
    await tocarEnLinea(tester, 'Queso gauda laminado', 'Agregar uno');
    await tester.pumpAndSettle();
    expect(find.text(r'$99.990'), findsWidgets);

    await tocarEnLinea(tester, 'Leche entera', 'Quitar del carro');
    expect(find.text('Leche entera'), findsNothing);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('2')), findsOneWidget);
    // Sin la línea sin stock ya se puede pagar.
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Ir a pagar')).onPressed, isNotNull);
  });

  testWidgets('agregar desde la ficha suma al carro', (tester) async {
    await entrarComo(tester, 'Comprador');
    await tester.tap(find.text('Abarrotes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aceite vegetal maravilla'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Agregar al carro').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agregar al carro').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Agregado al carro'), findsOneWidget);
    expect(find.text('Agregar otra (1 en el carro)'), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('4')), findsOneWidget);
  });

  testWidgets('el carro vacío ofrece ir al catálogo', (tester) async {
    usarPantallaDeTelefono(tester);
    await tester.pumpWidget(ProviderScope(overrides: overridesDePrueba(), child: const CotizappMobileApp()));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), 'compras@dulcehogar.test');
    await tester.enterText(find.widgetWithText(TextFormField, 'Clave'), 'Cotizapp.2026');
    await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    await tester.pumpAndSettle();
    await irA(tester, 'Carro');
    expect(find.text('Todavía no agregas nada'), findsOneWidget);
    expect(find.text('Ir al catálogo'), findsOneWidget);
  });
}
