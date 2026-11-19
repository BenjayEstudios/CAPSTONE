import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/format/formatos.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../ordenes/domain/orden.dart';
import '../../ordenes/presentation/ordenes_providers.dart';
import 'iniciar_pago.dart';

// Vuelta de la pasarela (KAN-131): confirmación con el folio si se pagó;
// si no, reintento. Contra la API real se llega acá mientras el usuario paga
// en el navegador, así que también consulta de nuevo al volver a la app.
class ResultadoPagoPage extends ConsumerStatefulWidget {
  const ResultadoPagoPage({super.key, required this.ordenId, this.error});

  final int ordenId;
  // Error al iniciar el pago (ej. la API aún no tiene POST /ordenes/:id/pago).
  final String? error;

  @override
  ConsumerState<ResultadoPagoPage> createState() => _ResultadoPagoPageState();
}

class _ResultadoPagoPageState extends ConsumerState<ResultadoPagoPage> {
  late final _ciclo = AppLifecycleListener(onResume: () => ref.invalidate(ordenProvider(widget.ordenId)));
  bool _reintentando = false;

  @override
  void initState() {
    super.initState();
    _ciclo;
  }

  @override
  void dispose() {
    _ciclo.dispose();
    super.dispose();
  }

  Future<void> _reintentar(Orden o) async {
    setState(() => _reintentando = true);
    await iniciarPagoYAbrir(context, ref, o.id, o.medioPago ?? MedioPago.tarjeta);
    if (mounted) setState(() => _reintentando = false);
  }

  @override
  Widget build(BuildContext context) {
    final orden = ref.watch(ordenProvider(widget.ordenId));
    return Scaffold(
      appBar: AppBar(title: const Text('Tu pedido'), automaticallyImplyLeading: false),
      body: AsyncValueView(
        value: orden,
        onReintentar: () => ref.invalidate(ordenProvider(widget.ordenId)),
        data: (o) => o.pagoPendiente ? _pendiente(context, o) : _aprobado(context, o),
      ),
    );
  }

  Widget _aprobado(BuildContext context, Orden o) {
    final textTheme = Theme.of(context).textTheme;
    final n = o.envios.length;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 12),
        const Center(
          child: CircleAvatar(
            radius: 40,
            backgroundColor: Color(0x222E9D5B),
            child: Icon(Icons.check_rounded, size: 48, color: AppColors.verde),
          ),
        ),
        const SizedBox(height: 16),
        Text('¡Pago aprobado!', textAlign: TextAlign.center, style: textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text('Folio ${o.codigo}',
            textAlign: TextAlign.center, style: textTheme.titleMedium?.copyWith(color: AppColors.magenta)),
        const SizedBox(height: 4),
        Text(
          'Pagaste ${formatearClp(o.total)}. Repartimos tu pedido entre ${n == 1 ? '1 proveedor' : '$n proveedores'}:',
          textAlign: TextAlign.center,
          style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
        ),
        const SizedBox(height: 16),
        Card(
          child: Column(
            children: [
              for (final e in o.envios)
                ListTile(
                  leading: Icon(e.esRetiro ? Icons.store_mall_directory_outlined : Icons.local_shipping_outlined,
                      color: AppColors.magenta),
                  title: Text(e.proveedorNombre),
                  subtitle: Text([
                    e.esRetiro ? 'Retiro en bodega' : 'Despacho',
                    if (e.plazoHoras != null) 'en ${formatearPlazo(e.plazoHoras!)}',
                  ].join(' ')),
                  trailing: Text(formatearClp(e.montoEnvio)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        FilledButton(onPressed: () => context.go(Rutas.pedido(o.id)), child: const Text('Ver detalle del pedido')),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: () => context.go(Rutas.comprador), child: const Text('Seguir comprando')),
      ],
    );
  }

  Widget _pendiente(BuildContext context, Orden o) {
    final textTheme = Theme.of(context).textTheme;
    final rechazado = o.pagoRechazado;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 12),
        Center(
          child: CircleAvatar(
            radius: 40,
            backgroundColor: AppColors.amarillo.withValues(alpha: 0.25),
            child:
                Icon(rechazado ? Icons.close_rounded : Icons.hourglass_top_rounded, size: 44, color: AppColors.texto),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          rechazado ? 'El pago no se completó' : 'Esperando la confirmación del pago',
          textAlign: TextAlign.center,
          style: textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          widget.error ??
              (rechazado
                  ? 'Tu pedido ${o.codigo} quedó guardado. Puedes intentar pagar de nuevo.'
                  : 'Cuando termines de pagar en la pasarela, vuelve a la app para ver el resultado.'),
          textAlign: TextAlign.center,
          style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
        ),
        const SizedBox(height: 8),
        Text('Folio ${o.codigo} · ${formatearClp(o.total)}', textAlign: TextAlign.center, style: textTheme.titleSmall),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _reintentando ? null : () => _reintentar(o),
          child: Text(rechazado || widget.error != null ? 'Reintentar pago' : 'Abrir la pasarela otra vez'),
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: () => ref.invalidate(ordenProvider(o.id)),
          child: const Text('Ya pagué, verificar'),
        ),
        const SizedBox(height: 10),
        TextButton(onPressed: () => context.go(Rutas.compradorPedidos), child: const Text('Ver mis pedidos')),
      ],
    );
  }
}
