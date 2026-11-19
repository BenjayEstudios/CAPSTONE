import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/error/failure.dart';
import '../../../core/router/rutas.dart';
import '../../ordenes/domain/orden.dart';
import 'checkout_providers.dart';

// Pide la URL de pago y manda al usuario a pagar: la pasarela simulada (fake)
// o el navegador (API real). Después queda en la pantalla de resultado, que
// consulta el estado de la orden. Si la API todavía no tiene
// POST /ordenes/:id/pago, la orden igual queda creada y pendiente de pago.
Future<void> iniciarPagoYAbrir(BuildContext context, WidgetRef ref, int ordenId, MedioPago medio) async {
  final router = GoRouter.of(context);
  try {
    final inicio = await ref.read(checkoutRepositoryProvider).iniciarPago(ordenId, medio);
    if (inicio.esSimulado) {
      router.go(Rutas.pasarela(ordenId, medio: medio));
      return;
    }
    await launchUrl(Uri.parse(inicio.urlPago), mode: LaunchMode.externalApplication);
    router.go(Rutas.resultadoPago(ordenId));
  } on Failure catch (f) {
    router.go(Rutas.resultadoPago(ordenId, error: f.message));
  }
}
