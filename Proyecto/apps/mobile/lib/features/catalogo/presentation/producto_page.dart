import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/analitica/analitica.dart';
import '../../../core/error/failure.dart';
import '../../../core/format/formatos.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../domain/catalogo_repository.dart';
import '../domain/categoria.dart';
import '../domain/producto.dart';
import '../../carro/presentation/carro_providers.dart';
import 'catalogo_providers.dart';
import 'widgets/calificacion_view.dart';
import 'widgets/visual_categoria.dart';

// Cómo ordenar el comparador: el cliente compara precio, plazo y
// calificación (descripción del proyecto).
enum OrdenComparador {
  precio('Precio'),
  plazo('Plazo'),
  calificacion('Calificación');

  const OrdenComparador(this.etiqueta);
  final String etiqueta;
}

// Ficha del producto con el comparador de proveedores (KAN-129).
class ProductoPage extends ConsumerStatefulWidget {
  const ProductoPage({super.key, required this.productoId, this.origen = OrigenVista.directo});

  final int productoId;
  final OrigenVista origen;

  @override
  ConsumerState<ProductoPage> createState() => _ProductoPageState();
}

class _ProductoPageState extends ConsumerState<ProductoPage> {
  OrdenComparador _orden = OrdenComparador.precio;

  @override
  void initState() {
    super.initState();
    ref.read(analiticaProvider).vistaProducto(widget.productoId, origen: widget.origen.name);
  }

  @override
  Widget build(BuildContext context) {
    final args = (id: widget.productoId, origen: widget.origen);
    final producto = ref.watch(productoProvider(args));

    return Scaffold(
      appBar: AppBar(title: const Text('Producto')),
      body: AsyncValueView(
        value: producto,
        onReintentar: () => ref.invalidate(productoProvider(args)),
        data: (p) => _contenido(context, p),
      ),
    );
  }

  Widget _contenido(BuildContext context, ProductoDetalle p) {
    final textTheme = Theme.of(context).textTheme;
    final raiz = ref.watch(categoriasProvider).valueOrNull?.raizDe(p.categoria.id)?.id;
    final ofertas = _ordenar(p.ofertas);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        Center(child: ImagenProducto(raizId: raiz, imagenUrl: p.imagenUrl, tamano: 140, radio: 28)),
        const SizedBox(height: 16),
        Text(
          [if (p.categoria.padreNombre != null) p.categoria.padreNombre!, p.categoria.nombre].join(' › '),
          style: textTheme.labelMedium?.copyWith(color: AppColors.magenta, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(p.nombre, style: textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          [if (p.marca != null) p.marca!, if (p.formato != null) p.formato!, 'SKU ${p.sku}'].join(' · '),
          style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
        ),
        const SizedBox(height: 16),
        if (p.ofertas.isEmpty)
          const VacioView(
            titulo: 'Sin proveedores por ahora',
            mensaje: 'Ningún proveedor tiene este producto publicado en este momento.',
          )
        else ...[
          _ResumenPrecios(producto: p),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  p.ofertas.length == 1 ? '1 proveedor lo vende' : '${p.ofertas.length} proveedores lo venden',
                  style: textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Puedes mezclar proveedores en el mismo carro y pagar una sola vez.',
            style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
          ),
          const SizedBox(height: 12),
          if (p.ofertas.length > 1) ...[
            SizedBox(
              width: double.infinity,
              child: SegmentedButton<OrdenComparador>(
                showSelectedIcon: false,
                segments: [
                  for (final o in OrdenComparador.values) ButtonSegment(value: o, label: Text(o.etiqueta)),
                ],
                selected: {_orden},
                onSelectionChanged: (sel) => setState(() => _orden = sel.first),
              ),
            ),
            const SizedBox(height: 12),
          ],
          for (final o in ofertas) ...[
            _TarjetaOferta(
              oferta: o,
              producto: p,
              insignias: _insignias(o, p.ofertas),
            ),
            const SizedBox(height: 12),
          ],
        ],
        const SizedBox(height: 12),
        Text('Sobre este producto', style: textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(
          p.descripcion ??
              'Ficha única para todos los proveedores: las diferencias de precio vienen del proveedor, no del producto.',
          style: textTheme.bodyMedium?.copyWith(height: 1.4),
        ),
      ],
    );
  }

  List<OfertaProducto> _ordenar(List<OfertaProducto> ofertas) {
    final lista = [...ofertas];
    switch (_orden) {
      case OrdenComparador.precio:
        lista.sort((a, b) => a.precioUnitario.compareTo(b.precioUnitario));
      case OrdenComparador.plazo:
        lista.sort((a, b) {
          final c = (a.plazoHoras ?? 9999).compareTo(b.plazoHoras ?? 9999);
          return c != 0 ? c : a.precioUnitario.compareTo(b.precioUnitario);
        });
      case OrdenComparador.calificacion:
        lista.sort((a, b) {
          final c = (b.proveedor.calificacion.promedio ?? 0).compareTo(a.proveedor.calificacion.promedio ?? 0);
          return c != 0 ? c : a.precioUnitario.compareTo(b.precioUnitario);
        });
    }
    return lista;
  }

  // "Más bajo", "Más rápido", "Mejor calificado": solo si hay con quién
  // comparar y la oferta gana sola (sin empates).
  List<String> _insignias(OfertaProducto o, List<OfertaProducto> todas) {
    if (todas.length < 2) return const [];
    bool unicoMejor<T extends num>(T? Function(OfertaProducto) valor, {required bool menor}) {
      final v = valor(o);
      if (v == null) return false;
      final valores = todas.map(valor).whereType<T>().toList();
      final mejor = valores.reduce((a, b) => (menor ? a < b : a > b) ? a : b);
      return v == mejor && valores.where((x) => x == mejor).length == 1;
    }

    return [
      if (unicoMejor<int>((x) => x.precioUnitario, menor: true)) 'Más bajo',
      if (unicoMejor<int>((x) => x.plazoHoras, menor: true)) 'Más rápido',
      if (unicoMejor<double>((x) => x.proveedor.calificacion.promedio, menor: false)) 'Mejor calificado',
    ];
  }
}

class _ResumenPrecios extends ConsumerWidget {
  const _ResumenPrecios({required this.producto});

  final ProductoDetalle producto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final min = producto.precioMinimo!;
    final max = producto.precioMaximo!;
    final porUnidad = precioPorUnidad(min, producto.contenido);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.tinta, AppColors.tintaClara],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Más bajo hoy', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 2),
                Text(
                  formatearClp(min),
                  style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                ),
                if (porUnidad != null)
                  Text(
                    formatearPrecioPorUnidad(porUnidad, producto.unidad.abreviatura),
                    style: const TextStyle(color: Colors.white70),
                  ),
              ],
            ),
          ),
          if (max > min)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.amarillo,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  const Text('Ahorras hasta', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                  Text(formatearClp(max - min), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TarjetaOferta extends ConsumerWidget {
  const _TarjetaOferta({required this.oferta, required this.producto, required this.insignias});

  final OfertaProducto oferta;
  final ProductoDetalle producto;
  final List<String> insignias;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final porUnidad = precioPorUnidad(oferta.precioUnitario, producto.contenido);
    final proveedor = oferta.proveedor;
    final masBajo = insignias.contains('Más bajo');

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: masBajo ? AppColors.magenta : AppColors.divisor, width: masBajo ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (insignias.isNotEmpty) ...[
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final i in insignias) _Insignia(texto: i)],
              ),
              const SizedBox(height: 10),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(proveedor.nombre, style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      CalificacionView(calificacion: proveedor.calificacion),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(formatearClp(oferta.precioUnitario),
                        style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    if (porUnidad != null)
                      Text(
                        formatearPrecioPorUnidad(porUnidad, producto.unidad.abreviatura),
                        style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (oferta.plazoHoras != null)
                  _Dato(icono: Icons.schedule_rounded, texto: 'Entrega ${formatearPlazo(oferta.plazoHoras!)}'),
                if (oferta.unidadesPorCaja != null)
                  _Dato(icono: Icons.inventory_2_outlined, texto: 'Caja de ${oferta.unidadesPorCaja} un'),
                if ((oferta.minimoCompra ?? 1) > 1)
                  _Dato(icono: Icons.shopping_bag_outlined, texto: 'Mínimo ${oferta.minimoCompra} cajas'),
                _Dato(
                  icono: oferta.modalidad == ModalidadEntrega.retiro
                      ? Icons.store_mall_directory_outlined
                      : Icons.local_shipping_outlined,
                  texto: oferta.modalidad.etiqueta,
                ),
                if (oferta.cajasDisponibles != null)
                  _Dato(
                    icono: Icons.check_circle_outline_rounded,
                    texto: oferta.cajasDisponibles! > 0 ? '${oferta.cajasDisponibles} cajas disponibles' : 'Sin stock',
                  ),
              ],
            ),
            if (_textoDespacho(proveedor) case final despacho?) ...[
              const SizedBox(height: 8),
              Text(despacho, style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
            ],
            if (oferta.notasCliente != null) ...[
              const SizedBox(height: 6),
              Text(oferta.notasCliente!, style: textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
            ],
            const SizedBox(height: 12),
            SizedBox(
                width: double.infinity,
                child: _BotonAgregar(oferta: oferta, productoId: producto.id, destacado: masBajo)),
          ],
        ),
      ),
    );
  }

  String? _textoDespacho(ProveedorOferta p) {
    final partes = [
      if (p.costoDespacho != null) 'Despacho ${formatearClp(p.costoDespacho!)}',
      if (p.despachoGratisDesde != null) 'gratis desde ${formatearClp(p.despachoGratisDesde!)}',
      if (p.entregasATiempoPct != null && p.entregasATiempoPct! > 0)
        '${p.entregasATiempoPct!.round()}% entregas a tiempo',
    ];
    return partes.isEmpty ? null : partes.join(' · ');
  }
}

// Agrega la oferta al carro (KAN-130) con la cantidad mínima; si ya está,
// suma. Muestra cuántas hay y un atajo al carro.
class _BotonAgregar extends ConsumerStatefulWidget {
  const _BotonAgregar({required this.oferta, required this.productoId, required this.destacado});

  final OfertaProducto oferta;
  final int productoId;
  final bool destacado;

  @override
  ConsumerState<_BotonAgregar> createState() => _BotonAgregarState();
}

class _BotonAgregarState extends ConsumerState<_BotonAgregar> {
  bool _agregando = false;

  Future<void> _agregar() async {
    setState(() => _agregando = true);
    final mensajero = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      ref.read(analiticaProvider).clickOferta(widget.productoId, widget.oferta.id);
      await ref.read(carroProvider.notifier).agregar(widget.oferta);
      mensajero
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text('Agregado al carro: ${widget.oferta.proveedor.nombre}'),
          action: SnackBarAction(label: 'Ver carro', onPressed: () => router.go(Rutas.compradorCarro)),
        ));
    } on Failure catch (f) {
      mensajero
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(f.message)));
    } finally {
      if (mounted) setState(() => _agregando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enCarro =
        ref.watch(carroProvider).valueOrNull?.items.where((i) => i.ofertaId == widget.oferta.id).firstOrNull;
    final icono = _agregando
        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
        : Icon(enCarro == null ? Icons.add_shopping_cart_rounded : Icons.shopping_cart_checkout_rounded);
    final texto = Text(enCarro == null ? 'Agregar al carro' : 'Agregar otra (${enCarro.cantidad} en el carro)');
    final onPressed = _agregando ? null : _agregar;
    return widget.destacado
        ? FilledButton.icon(onPressed: onPressed, icon: icono, label: texto)
        : OutlinedButton.icon(onPressed: onPressed, icon: icono, label: texto);
  }
}

class _Insignia extends StatelessWidget {
  const _Insignia({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final (color, icono) = switch (texto) {
      'Más bajo' => (AppColors.magenta, Icons.trending_down_rounded),
      'Más rápido' => (AppColors.acento, Icons.bolt_rounded),
      _ => (const Color(0xFFB98E00), Icons.star_rounded),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icono, size: 14, color: color),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              texto,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppColors.superficie, borderRadius: BorderRadius.circular(10)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icono, size: 14, color: AppColors.textoSuave),
          const SizedBox(width: 4),
          Flexible(child: Text(texto, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}
