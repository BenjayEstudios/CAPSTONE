import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/format/formatos.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../ordenes/domain/orden.dart';
import '../../ordenes/presentation/ordenes_providers.dart';
import 'checkout_providers.dart';

// Reemplaza a Webpay/MercadoPago mientras la pasarela no exista (KAN-148):
// muestra lo que cobraría la pasarela y deja aprobar o rechazar el pago.
// Solo se usa con USE_FAKES=true; no hay cobro real.
class PasarelaSimuladaPage extends ConsumerStatefulWidget {
  const PasarelaSimuladaPage({super.key, required this.ordenId, required this.medio});

  final int ordenId;
  final MedioPago medio;

  @override
  ConsumerState<PasarelaSimuladaPage> createState() => _PasarelaSimuladaPageState();
}

class _PasarelaSimuladaPageState extends ConsumerState<PasarelaSimuladaPage> {
  bool _procesando = false;

  Future<void> _resolver({required bool aprobado}) async {
    final backend = ref.read(pasarelaSimuladaProvider);
    if (backend == null) return;
    setState(() => _procesando = true);
    // Lo que tarda una pasarela en responder.
    await Future<void>.delayed(const Duration(milliseconds: 900));
    backend.resolverPago(widget.ordenId, aprobado: aprobado);
    ref
      ..invalidate(ordenProvider(widget.ordenId))
      ..invalidate(ordenesProvider);
    if (mounted) context.go(Rutas.resultadoPago(widget.ordenId));
  }

  @override
  Widget build(BuildContext context) {
    final orden = ref.watch(ordenProvider(widget.ordenId));
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: const Color(0xFFEEF1F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFFEEF1F6),
        automaticallyImplyLeading: false,
        title: const Row(
          children: [
            Icon(Icons.lock_rounded, size: 18, color: AppColors.verde),
            SizedBox(width: 6),
            Text('Pasarela de pago', style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
      body: AsyncValueView(
        value: orden,
        onReintentar: () => ref.invalidate(ordenProvider(widget.ordenId)),
        data: (o) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.amarillo.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Simulación para la demo: no se hace ningún cobro. La pasarela real (Webpay o MercadoPago) '
                'llega con KAN-148.',
                style: TextStyle(fontSize: 12),
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Comercio', style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                    const Text('Cotizapp SpA', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Text('Orden', style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                    Text(o.codigo, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Text('Monto a pagar', style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                    Text(formatearClp(o.total), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
                    const Divider(height: 28),
                    Row(
                      children: [
                        Icon(_iconoMedio(widget.medio), color: AppColors.acento),
                        const SizedBox(width: 10),
                        Expanded(child: Text(widget.medio.etiqueta)),
                      ],
                    ),
                    if (widget.medio == MedioPago.tarjeta) ...[
                      const SizedBox(height: 10),
                      Text('Tarjeta de prueba •••• 6623',
                          style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: AppColors.verde),
              onPressed: _procesando ? null : () => _resolver(aprobado: true),
              icon: _procesando
                  ? const SizedBox.square(
                      dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_rounded),
              label: const Text('Aprobar pago'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _procesando ? null : () => _resolver(aprobado: false),
              child: const Text('Rechazar pago'),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconoMedio(MedioPago m) => switch (m) {
        MedioPago.tarjeta => Icons.credit_card_rounded,
        MedioPago.transferencia => Icons.account_balance_rounded,
        MedioPago.lineaCredito => Icons.request_quote_outlined,
      };
}
