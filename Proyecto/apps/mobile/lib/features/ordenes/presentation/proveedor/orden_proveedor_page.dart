import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/estado_views.dart';
import '../estado_chip.dart';
import '../ordenes_providers.dart';
import 'avanzar_envio.dart';

// Detalle de una orden para el distribuidor (KAN-136): qué preparar, para
// quién, dónde entregar y cuánto recibe.
class OrdenProveedorPage extends ConsumerWidget {
  const OrdenProveedorPage({super.key, required this.ordenId});

  final int ordenId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orden = ref.watch(ordenProvider(ordenId));
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(orden.valueOrNull?.codigo ?? 'Orden')),
      body: AsyncValueView(
        value: orden,
        onReintentar: () => ref.invalidate(ordenProvider(ordenId)),
        data: (o) {
          final e = o.envios.single;
          final siguiente = e.estado.siguiente(esRetiro: e.esRetiro);
          Widget fila(String a, String b, {bool fuerte = false}) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Expanded(child: Text(a, style: fuerte ? textTheme.titleSmall : null)),
                  Text(b, style: fuerte ? textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800) : null),
                ]),
              );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(children: [
                        Expanded(child: Text(o.clienteOrganizacion ?? 'Cliente', style: textTheme.titleMedium)),
                        EstadoChip.envio(e.estado),
                      ]),
                      if (o.clienteNombre != null) Text(o.clienteNombre!, style: textTheme.bodySmall),
                      const SizedBox(height: 8),
                      Text('Pagada el ${formatearFechaHora(o.pagadoEn ?? o.creadaEn)}',
                          style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                      Text(
                        e.esRetiro
                            ? 'Retira en ${e.puntoRetiro?.nombre ?? 'tu bodega'}'
                            : 'Despachar a ${o.direccion == null ? (o.comuna ?? '-') : '${o.direccion!.texto}, ${o.direccion!.comuna}'}',
                        style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                      ),
                      if (o.direccion?.referencia != null)
                        Text(o.direccion!.referencia!,
                            style: textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
                      if (e.plazoHoras != null)
                        Text('Plazo comprometido: ${formatearPlazo(e.plazoHoras!)}',
                            style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Qué preparar', style: textTheme.titleSmall),
                      const SizedBox(height: 8),
                      for (final l in e.lineas)
                        fila('${l.cantidad} × ${l.nombreProducto}${l.formato == null ? '' : ' · ${l.formato}'}',
                            formatearClp(l.totalLinea)),
                      const Divider(height: 20),
                      fila('Productos', formatearClp(e.subtotal)),
                      fila('Despacho', formatearClp(e.costoDespacho)),
                      if (e.montoALiquidar != null) ...[
                        fila('Comisión Cotizapp', '-${formatearClp(e.montoEnvio - e.montoALiquidar!)}'),
                        const Divider(height: 20),
                        fila('Recibes', formatearClp(e.montoALiquidar!), fuerte: true),
                      ],
                    ],
                  ),
                ),
              ),
              if (siguiente != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => avanzarEnvio(context, ref, o, e),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Text(accionAvanzar(siguiente)),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
