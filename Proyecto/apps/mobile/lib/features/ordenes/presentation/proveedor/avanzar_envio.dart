import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/error/failure.dart';
import '../../domain/orden.dart';
import '../ordenes_providers.dart';

// Texto del botón para pasar un envío a su siguiente estado.
String accionAvanzar(EstadoEnvio siguiente) => switch (siguiente) {
      EstadoEnvio.enPreparacion => 'Empezar a preparar',
      EstadoEnvio.despachado => 'Marcar despachado',
      EstadoEnvio.listoRetiro => 'Listo para retiro',
      EstadoEnvio.entregado => 'Marcar entregado',
      _ => siguiente.etiqueta,
    };

// Confirma y llama PATCH /ordenes/envios/:id/estado. Refresca la lista y el
// detalle; los errores del backend (TRANSICION_INVALIDA, ORDEN_NO_PAGADA)
// se muestran tal cual.
Future<void> avanzarEnvio(BuildContext context, WidgetRef ref, Orden orden, EnvioOrden envio) async {
  final siguiente = envio.estado.siguiente(esRetiro: envio.esRetiro);
  if (siguiente == null) return;
  final confirmado = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('${accionAvanzar(siguiente)}?'),
      content: Text('${orden.codigo} · ${orden.clienteOrganizacion ?? 'Cliente'}\n'
          'El cliente verá el envío como "${siguiente.etiqueta}".'),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Confirmar')),
      ],
    ),
  );
  if (confirmado != true || !context.mounted) return;
  final mensajero = ScaffoldMessenger.of(context);
  try {
    await ref.read(ordenesRepositoryProvider).cambiarEstadoEnvio(envio.id, siguiente);
    ref
      ..invalidate(ordenesProvider)
      ..invalidate(ordenProvider(orden.id));
    mensajero.showSnackBar(SnackBar(content: Text('${orden.codigo}: ${siguiente.etiqueta.toLowerCase()}')));
  } on Failure catch (f) {
    mensajero.showSnackBar(SnackBar(content: Text(f.message)));
  }
}
