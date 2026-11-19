import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/estado_views.dart';
import '../../../checkout/presentation/iniciar_pago.dart';
import '../../domain/orden.dart';
import '../estado_chip.dart';
import '../ordenes_providers.dart';
import 'calificar_sheet.dart';

// Detalle de un pedido (KAN-132): un bloque por envío/proveedor con su
// seguimiento, líneas y montos, y la calificación cuando ya se entregó.
class PedidoPage extends ConsumerWidget {
  const PedidoPage({super.key, required this.ordenId});

  final int ordenId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orden = ref.watch(ordenProvider(ordenId));
    return Scaffold(
      appBar: AppBar(title: Text(orden.valueOrNull?.codigo ?? 'Pedido')),
      body: AsyncValueView(
        value: orden,
        onReintentar: () => ref.invalidate(ordenProvider(ordenId)),
        data: (o) => RefreshIndicator(
          onRefresh: () => ref.refresh(ordenProvider(ordenId).future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _Encabezado(orden: o),
              const SizedBox(height: 16),
              for (final e in o.envios) ...[
                _TarjetaEnvio(orden: o, envio: e),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Encabezado extends ConsumerWidget {
  const _Encabezado({required this.orden});

  final Orden orden;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    Widget fila(String a, String b) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [Expanded(child: Text(a)), Text(b)]),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text(formatearFechaHora(orden.creadaEn), style: textTheme.bodySmall)),
                EstadoChip.orden(orden.estado),
              ],
            ),
            const SizedBox(height: 12),
            fila('Productos', formatearClp(orden.subtotal)),
            fila('Despachos', orden.costoDespachoTotal == 0 ? 'Gratis' : formatearClp(orden.costoDespachoTotal)),
            const Divider(height: 16),
            Row(
              children: [
                Expanded(child: Text('Total', style: textTheme.titleMedium)),
                Text(formatearClp(orden.total), style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              [
                if (orden.medioPago != null) orden.medioPago!.etiqueta,
                if (orden.requiereFactura) 'con factura',
              ].join(' · '),
              style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
            ),
            if (orden.direccion != null) ...[
              const SizedBox(height: 4),
              Text('Despacho a ${orden.direccion!.texto}, ${orden.direccion!.comuna}',
                  style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
            ],
            if (orden.pagoPendiente) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => iniciarPagoYAbrir(context, ref, orden.id, orden.medioPago ?? MedioPago.tarjeta),
                icon: const Icon(Icons.lock_outline_rounded),
                label: const Text('Pagar ahora'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TarjetaEnvio extends StatelessWidget {
  const _TarjetaEnvio({required this.orden, required this.envio});

  final Orden orden;
  final EnvioOrden envio;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final cancelado = envio.estado == EstadoEnvio.cancelado;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(envio.esRetiro ? Icons.store_mall_directory_outlined : Icons.local_shipping_outlined,
                    color: AppColors.magenta),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(envio.proveedorNombre,
                        style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                EstadoChip.envio(envio.estado),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              envio.esRetiro
                  ? 'Retiro en ${envio.puntoRetiro?.nombre ?? 'la bodega del proveedor'}'
                  : 'Despacho${envio.plazoHoras != null ? ' en ${formatearPlazo(envio.plazoHoras!)}' : ''}',
              style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
            ),
            if (envio.esRetiro && envio.puntoRetiro != null)
              Text(
                [envio.puntoRetiro!.direccion, if (envio.puntoRetiro!.horario != null) envio.puntoRetiro!.horario!]
                    .join(' · '),
                style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
              ),
            if (!cancelado && !orden.pagoPendiente) ...[
              const SizedBox(height: 14),
              _Seguimiento(envio: envio),
            ],
            const Divider(height: 24),
            for (final l in envio.lineas)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${l.cantidad} ×  ', style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    Expanded(
                      child: Text([l.nombreProducto, if (l.formato != null) l.formato!].join(' · '),
                          style: textTheme.bodyMedium),
                    ),
                    Text(formatearClp(l.totalLinea)),
                  ],
                ),
              ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    envio.costoDespacho == 0
                        ? (envio.esRetiro ? 'Retiro sin costo' : 'Despacho gratis')
                        : 'Despacho ${formatearClp(envio.costoDespacho)}',
                    style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                  ),
                ),
                Text(formatearClp(envio.montoEnvio), style: textTheme.titleSmall),
              ],
            ),
            if (envio.calificacion != null) ...[
              const Divider(height: 24),
              _TuCalificacion(calificacion: envio.calificacion!),
            ] else if (envio.calificable) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  final ok = await mostrarCalificar(context, ordenId: orden.id, envio: envio);
                  if ((ok ?? false) && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('¡Gracias! Tu calificación ayuda a otros compradores.')),
                    );
                  }
                },
                icon: const Icon(Icons.star_outline_rounded),
                label: Text('Calificar a ${envio.proveedorNombre}'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Pasos del envío con el actual marcado.
class _Seguimiento extends StatelessWidget {
  const _Seguimiento({required this.envio});

  final EnvioOrden envio;

  @override
  Widget build(BuildContext context) {
    final pasos = EstadoEnvio.pasos(esRetiro: envio.esRetiro);
    final actual = pasos.indexOf(envio.estado);
    return Row(
      children: [
        for (final (i, paso) in pasos.indexed) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: i <= actual ? AppColors.verde : AppColors.superficie,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  paso.etiqueta,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: i == actual ? FontWeight.w700 : FontWeight.w400,
                    color: i <= actual ? AppColors.texto : AppColors.textoSuave,
                  ),
                ),
              ],
            ),
          ),
          if (i < pasos.length - 1) const SizedBox(width: 4),
        ],
      ],
    );
  }
}

class _TuCalificacion extends StatelessWidget {
  const _TuCalificacion({required this.calificacion});

  final CalificacionEnvio calificacion;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Tu calificación  ', style: TextStyle(fontWeight: FontWeight.w600)),
            for (var i = 1; i <= 5; i++)
              Icon(i <= calificacion.puntaje ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 18, color: AppColors.amarillo),
          ],
        ),
        if (calificacion.comentario != null) ...[
          const SizedBox(height: 4),
          Text('“${calificacion.comentario!}”', style: const TextStyle(fontStyle: FontStyle.italic)),
        ],
      ],
    );
  }
}
