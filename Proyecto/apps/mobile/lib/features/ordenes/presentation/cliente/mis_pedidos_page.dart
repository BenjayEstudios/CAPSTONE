import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/router/rutas.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/estado_views.dart';
import '../../../checkout/presentation/iniciar_pago.dart';
import '../../domain/orden.dart';
import '../estado_chip.dart';
import '../ordenes_providers.dart';

// Mis pedidos (KAN-132): historial de órdenes del comprador con su estado.
class MisPedidosPage extends ConsumerWidget {
  const MisPedidosPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordenes = ref.watch(ordenesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mis pedidos')),
      body: AsyncValueView(
        value: ordenes,
        onReintentar: () => ref.invalidate(ordenesProvider),
        data: (lista) => lista.isEmpty
            ? VacioView(
                titulo: 'Todavía no tienes pedidos',
                mensaje: 'Cuando pagues tu primer carro, lo vas a ver acá con su estado.',
                accion:
                    OutlinedButton(onPressed: () => context.go(Rutas.comprador), child: const Text('Ir al catálogo')),
              )
            : RefreshIndicator(
                onRefresh: () => ref.refresh(ordenesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: lista.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _TarjetaPedido(orden: lista[i]),
                ),
              ),
      ),
    );
  }
}

class _TarjetaPedido extends ConsumerWidget {
  const _TarjetaPedido({required this.orden});

  final Orden orden;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final proveedores = orden.envios.map((e) => e.proveedorNombre).toList();
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Rutas.pedido(orden.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(orden.codigo, style: textTheme.titleMedium)),
                  EstadoChip.orden(orden.estado),
                ],
              ),
              const SizedBox(height: 4),
              Text(formatearFecha(orden.creadaEn), style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
              const SizedBox(height: 8),
              Text(
                proveedores.join(' · '),
                style: textTheme.bodyMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      orden.pagoRechazado
                          ? 'El último intento de pago fue rechazado'
                          : (orden.medioPago?.etiqueta ?? ''),
                      style: textTheme.bodySmall
                          ?.copyWith(color: orden.pagoRechazado ? AppColors.magenta : AppColors.textoSuave),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(formatearClp(orden.total), style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                ],
              ),
              if (orden.pagoPendiente) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => iniciarPagoYAbrir(context, ref, orden.id, orden.medioPago ?? MedioPago.tarjeta),
                    icon: const Icon(Icons.lock_outline_rounded),
                    label: const Text('Pagar ahora'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
