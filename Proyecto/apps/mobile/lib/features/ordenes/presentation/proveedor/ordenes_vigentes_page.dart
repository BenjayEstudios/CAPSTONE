import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/router/rutas.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/estado_views.dart';
import '../../domain/orden.dart';
import '../estado_chip.dart';
import '../ordenes_providers.dart';
import 'avanzar_envio.dart';

// Órdenes vigentes del distribuidor (KAN-136): sus envíos por preparar,
// despachar o entregar, del más antiguo al más nuevo, con el botón para
// avanzar cada uno. El historial muestra lo entregado y cancelado.
class OrdenesVigentesPage extends ConsumerStatefulWidget {
  const OrdenesVigentesPage({super.key});

  @override
  ConsumerState<OrdenesVigentesPage> createState() => _OrdenesVigentesPageState();
}

class _OrdenesVigentesPageState extends ConsumerState<OrdenesVigentesPage> {
  bool _historial = false;

  @override
  Widget build(BuildContext context) {
    final ordenes = ref.watch(ordenesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Órdenes')),
      body: AsyncValueView(
        value: ordenes,
        onReintentar: () => ref.invalidate(ordenesProvider),
        data: (todas) {
          // El proveedor ve una orden por cada envío suyo (siempre uno).
          final pagadas = todas.where((o) => !o.pagoPendiente && o.envios.isNotEmpty).toList();
          final vigentes = pagadas.where((o) => o.envios.single.estado.vigente).toList()
            ..sort((a, b) => a.creadaEn.compareTo(b.creadaEn));
          final historial = pagadas.where((o) => !o.envios.single.estado.vigente).toList();
          final lista = _historial ? historial : vigentes;

          return RefreshIndicator(
            onRefresh: () => ref.refresh(ordenesProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(value: false, label: Text('Vigentes (${vigentes.length})')),
                    ButtonSegment(value: true, label: Text('Historial (${historial.length})')),
                  ],
                  selected: {_historial},
                  onSelectionChanged: (s) => setState(() => _historial = s.first),
                ),
                const SizedBox(height: 12),
                if (!_historial && vigentes.isNotEmpty) ...[
                  _ResumenEstados(vigentes: vigentes),
                  const SizedBox(height: 12),
                ],
                if (lista.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 48),
                    child: VacioView(
                      titulo: _historial ? 'Sin envíos entregados todavía' : 'No tienes envíos pendientes',
                      mensaje: _historial ? null : 'Cuando un cliente pague una orden con tus productos, aparece acá.',
                    ),
                  ),
                for (final o in lista) ...[
                  _TarjetaOrden(orden: o),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ResumenEstados extends StatelessWidget {
  const _ResumenEstados({required this.vigentes});

  final List<Orden> vigentes;

  @override
  Widget build(BuildContext context) {
    final porEstado = <EstadoEnvio, int>{};
    for (final o in vigentes) {
      porEstado.update(o.envios.single.estado, (n) => n + 1, ifAbsent: () => 1);
    }
    final monto = vigentes.fold(0, (s, o) => s + o.total);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(colors: [AppColors.tinta, AppColors.tintaClara]),
      ),
      child: Row(
        children: [
          Expanded(
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                for (final e in EstadoEnvio.values)
                  if (porEstado[e] != null)
                    Text('${porEstado[e]} ${e.etiqueta.toLowerCase()}', style: const TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text('En curso', style: TextStyle(color: Colors.white70, fontSize: 12)),
              Text(formatearClp(monto),
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TarjetaOrden extends ConsumerWidget {
  const _TarjetaOrden({required this.orden});

  final Orden orden;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final envio = orden.envios.single;
    final siguiente = envio.estado.siguiente(esRetiro: envio.esRetiro);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Rutas.ordenProveedor(orden.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text(orden.codigo, style: textTheme.titleMedium),
                  const Spacer(),
                  EstadoChip.envio(envio.estado),
                ],
              ),
              const SizedBox(height: 6),
              Text(orden.clienteOrganizacion ?? orden.clienteNombre ?? 'Cliente',
                  style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              Text(
                [
                  formatearFecha(orden.creadaEn),
                  envio.esRetiro ? 'retiro en bodega' : 'despacho${orden.comuna != null ? ' a ${orden.comuna}' : ''}',
                ].join(' · '),
                style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      envio.montoALiquidar == null ? '' : 'Recibes ${formatearClp(envio.montoALiquidar!)}',
                      style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                    ),
                  ),
                  Text(formatearClp(orden.total), style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                ],
              ),
              if (siguiente != null) ...[
                const SizedBox(height: 10),
                FilledButton.tonalIcon(
                  onPressed: () => avanzarEnvio(context, ref, orden, envio),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Text(accionAvanzar(siguiente)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
