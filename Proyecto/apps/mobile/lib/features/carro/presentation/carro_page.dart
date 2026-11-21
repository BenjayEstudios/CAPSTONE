import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/error/failure.dart';
import '../../../core/format/formatos.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../catalogo/presentation/catalogo_providers.dart';
import '../../catalogo/presentation/widgets/calificacion_view.dart';
import '../../catalogo/presentation/widgets/visual_categoria.dart';
import '../../catalogo/domain/categoria.dart';
import '../domain/carro.dart';
import 'carro_providers.dart';
import 'widgets/selector_cantidad.dart';

// Carro multiproveedor (KAN-130): un grupo por proveedor (será un envío),
// resumen con despachos y ahorro, y barra inferior con el total.
class CarroPage extends ConsumerWidget {
  const CarroPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final carro = ref.watch(carroProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tu carro')),
      body: carro.when(
        skipLoadingOnRefresh: true,
        skipLoadingOnReload: true,
        loading: () => const CargandoView(),
        error: (e, _) => ErrorView(error: e, onReintentar: () => ref.invalidate(carroProvider)),
        data: (c) => c.estaVacio ? const _CarroVacio() : _Contenido(carro: c, guardando: carro.isLoading),
      ),
      bottomNavigationBar: switch (carro.valueOrNull) {
        final c? when !c.estaVacio => _BarraTotal(carro: c, guardando: carro.isLoading),
        _ => null,
      },
    );
  }
}

// Ejecuta una operación del carro y muestra el error del backend, si hay.
Future<void> operarCarro(BuildContext context, Future<void> Function() operacion) async {
  try {
    await operacion();
  } on Failure catch (f) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(f.message)));
  }
}

class _CarroVacio extends StatelessWidget {
  const _CarroVacio();

  @override
  Widget build(BuildContext context) {
    return VacioView(
      titulo: 'Todavía no agregas nada',
      mensaje: 'Abre un producto, revisa qué proveedores lo venden y compra al que te convenga.',
      accion: FilledButton.icon(
        onPressed: () => context.go(Rutas.catalogo()),
        icon: const Icon(Icons.storefront_rounded),
        label: const Text('Ir al catálogo'),
      ),
    );
  }
}

class _Contenido extends ConsumerWidget {
  const _Contenido({required this.carro, required this.guardando});

  final CarroDetallado carro;
  final bool guardando;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final proveedores = carro.grupos.length;
    return RefreshIndicator(
      onRefresh: () => ref.read(carroProvider.notifier).recargar(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          if (guardando) const LinearProgressIndicator(minHeight: 2) else const SizedBox(height: 2),
          const SizedBox(height: 6),
          Text(
            '${carro.cantidadLineas == 1 ? '1 producto' : '${carro.cantidadLineas} productos'} · '
            '${proveedores == 1 ? '1 proveedor' : '$proveedores proveedores'}',
            style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
          ),
          const SizedBox(height: 4),
          Text(
            'Pagas una sola vez y repartimos el pedido entre cada proveedor.',
            style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
          ),
          if (carro.hayPreciosCambiados || carro.hayNoDisponibles) ...[
            const SizedBox(height: 12),
            _AvisoPrecios(carro: carro),
          ],
          const SizedBox(height: 12),
          for (final g in carro.grupos) ...[
            _TarjetaGrupo(grupo: g, guardando: guardando),
            const SizedBox(height: 12),
          ],
          _Resumen(carro: carro),
        ],
      ),
    );
  }
}

class _AvisoPrecios extends ConsumerWidget {
  const _AvisoPrecios({required this.carro});

  final CarroDetallado carro;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.amarillo.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            carro.hayNoDisponibles
                ? 'Algunos productos ya no están disponibles y otros pueden haber cambiado de precio.'
                : 'Algunos precios cambiaron desde que los agregaste.',
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => operarCarro(context, () => ref.read(carroProvider.notifier).actualizarPrecios()),
            child: const Text('Actualizar carro'),
          ),
        ],
      ),
    );
  }
}

class _TarjetaGrupo extends ConsumerWidget {
  const _TarjetaGrupo({required this.grupo, required this.guardando});

  final GrupoCarro grupo;
  final bool guardando;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final plazo = grupo.plazoHoras;
    final despacho = grupo.despachoEstimado;
    final falta = grupo.faltaParaGratis;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.storefront_rounded, color: AppColors.magenta, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text(grupo.nombre, style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                if (plazo != null)
                  Text('Entrega ${formatearPlazo(plazo)}',
                      style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
              ],
            ),
            if (grupo.proveedor != null) ...[
              const SizedBox(height: 2),
              Padding(
                padding: const EdgeInsets.only(left: 28),
                child: CalificacionView(calificacion: grupo.proveedor!.calificacion),
              ),
            ],
            const Divider(height: 20),
            for (final l in grupo.lineas) _LineaView(linea: l, guardando: guardando),
            const Divider(height: 16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    despacho == 0
                        ? 'Despacho gratis'
                        : 'Despacho ${formatearClp(despacho)}${falta != null ? ' · gratis si sumas ${formatearClp(falta)}' : ''}',
                    style: textTheme.bodySmall?.copyWith(color: despacho == 0 ? AppColors.verde : AppColors.textoSuave),
                  ),
                ),
                Text('Subtotal ${formatearClp(grupo.subtotal)}', style: textTheme.titleSmall),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LineaView extends ConsumerWidget {
  const _LineaView({required this.linea, required this.guardando});

  final LineaCarro linea;
  final bool guardando;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final item = linea.item;
    final raiz = linea.producto == null
        ? null
        : ref.watch(categoriasProvider).valueOrNull?.raizDe(linea.producto!.categoria.id)?.id;
    final notifier = ref.read(carroProvider.notifier);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ImagenProducto(raizId: raiz, tamano: 48, radio: 12),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(linea.nombre, style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                Text(
                  [if (item.formato != null) item.formato!, '${formatearClp(item.precio)} c/u'].join(' · '),
                  style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                ),
                if (item.precioCambio)
                  Text('Antes ${formatearClp(item.precioVisto)}',
                      style: textTheme.bodySmall?.copyWith(color: AppColors.magenta, fontWeight: FontWeight.w600)),
                if (linea.excedeStock)
                  Text(
                    'Solo quedan ${linea.cantidadMaxima}: ajusta la cantidad',
                    style: textTheme.bodySmall?.copyWith(color: AppColors.magenta, fontWeight: FontWeight.w600),
                  ),
                if (!item.disponible)
                  Text('Ya no está disponible',
                      style: textTheme.bodySmall?.copyWith(color: AppColors.magenta, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    SelectorCantidad(
                      cantidad: item.cantidad,
                      minima: linea.cantidadMinima,
                      maxima: linea.cantidadMaxima,
                      habilitado: !guardando && item.disponible,
                      onCambiar: (n) => operarCarro(context, () => notifier.cambiarCantidad(item.ofertaId, n)),
                    ),
                    IconButton(
                      tooltip: 'Quitar del carro',
                      icon: const Icon(Icons.delete_outline_rounded),
                      color: AppColors.textoSuave,
                      onPressed: guardando ? null : () => operarCarro(context, () => notifier.quitar(item.ofertaId)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(formatearClp(item.total), style: textTheme.titleSmall),
        ],
      ),
    );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({required this.carro});

  final CarroDetallado carro;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    Widget fila(String texto, String valor, {Color? color, bool fuerte = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(child: Text(texto, style: fuerte ? textTheme.titleMedium : textTheme.bodyMedium)),
              Text(valor,
                  style: (fuerte ? textTheme.titleMedium : textTheme.bodyMedium)
                      ?.copyWith(color: color, fontWeight: fuerte ? FontWeight.w800 : FontWeight.w600)),
            ],
          ),
        );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            fila('Productos (${carro.cantidadLineas})', formatearClp(carro.subtotal)),
            fila('Despachos (${carro.grupos.length})', carro.despachos == 0 ? 'Gratis' : formatearClp(carro.despachos)),
            if (carro.ahorro > 0)
              fila('Ahorro vs. el más caro', '-${formatearClp(carro.ahorro)}', color: AppColors.verde),
            const Divider(height: 20),
            fila('Total', formatearClp(carro.total), fuerte: true),
            const SizedBox(height: 4),
            Text(
              'El despacho final se calcula con tu dirección al pagar.',
              style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
            ),
          ],
        ),
      ),
    );
  }
}

class _BarraTotal extends StatelessWidget {
  const _BarraTotal({required this.carro, required this.guardando});

  final CarroDetallado carro;
  final bool guardando;

  @override
  Widget build(BuildContext context) {
    final bloqueado = guardando || !carro.listoParaPagar;
    return Material(
      color: Colors.white,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      carro.listoParaPagar ? 'Total' : 'Revisa los avisos del carro',
                      style: TextStyle(color: carro.listoParaPagar ? AppColors.textoSuave : AppColors.magenta),
                    ),
                    Text(formatearClp(carro.total), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: bloqueado ? null : () => context.push(Rutas.checkout),
                icon: const Icon(Icons.lock_outline_rounded),
                label: const Text('Ir a pagar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
